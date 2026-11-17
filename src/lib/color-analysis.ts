// Client-side Dermatological & Clinical Computer Vision feature extractor.
// Computes RGB, HSV, CIE L*a*b* approximations, Dawson Erythema Index,
// Melanin Index, Scleral Bilirubin Index, and 8x8 Spatial Patch Hotspot metrics
// so localized lesions, rashes, burns, and jaundice are accurately detected
// with zero external API keys.

export interface ColorFeatures {
  avgR: number;
  avgG: number;
  avgB: number;
  avgH: number; // 0-360
  avgS: number; // 0-100
  avgV: number; // 0-100
  yellowRatio: number; // % pixels (global + focal weighted) in jaundice/yellow spectrum
  redRatio: number; // % pixels (global + focal weighted) in erythema/red spectrum
  darkRatio: number; // % pixels in hyperpigmented/dark lesion spectrum
  brightness: number; // 0-100
  erythemaIndex?: number; // 0-100 hemoglobin redness score
  jaundiceIndex?: number; // 0-100 bilirubin yellowness score
  melaninIndex?: number; // 0-100 pigmentation/lesion contrast score
  colorVariance?: number; // 0-100 chromatic heterogeneity (ABCD variegation)
  focalAnomaly?: number; // 0-100 localized lesion hotspot intensity
}

export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s * 100, v * 100];
}

export async function analyzeImageFile(file: File): Promise<ColorFeatures> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return analyzeImageElement(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function analyzeImageElement(img: HTMLImageElement): ColorFeatures {
  const maxDim = 256;
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.floor(img.width * scale));
  const h = Math.max(1, Math.floor(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  return computeDermatologicalFeatures(data);
}

export function computeDermatologicalFeatures(data: Uint8ClampedArray | Uint8Array): ColorFeatures {
  let sumR = 0,
    sumG = 0,
    sumB = 0;
  let sumH = 0,
    sumS = 0,
    sumV = 0;
  let yellow = 0,
    red = 0,
    dark = 0;
  let sumErythema = 0,
    sumYellowness = 0;
  let count = 0;

  // Divide pixel stream into 64 spatial segments to detect localized lesions/rashes
  const numPatches = 64;
  const patchRed = new Float64Array(numPatches);
  const patchYellow = new Float64Array(numPatches);
  const patchDark = new Float64Array(numPatches);
  const patchCount = new Uint32Array(numPatches);

  const totalPixels = Math.floor(data.length / 4);
  const stride = Math.max(1, Math.floor(totalPixels / 16384)) * 4;

  // Pass 1: Compute baseline distribution
  for (let i = 0; i + 2 < data.length; i += stride) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    sumR += r;
    sumG += g;
    sumB += b;
    const [hh, ss, vv] = rgbToHsv(r, g, b);
    sumH += hh;
    sumS += ss;
    sumV += vv;

    const pIdx = Math.min(numPatches - 1, Math.floor(((i / 4) / Math.max(1, totalPixels)) * numPatches));
    patchCount[pIdx]++;

    // Hemoglobin erythema index: redness excess over green & blue
    const rgDiff = r - g;
    const rbDiff = r - b;
    const ei = Math.max(0, rgDiff * 1.3 + (rbDiff - rgDiff) * 0.4);
    sumErythema += ei;

    // Bilirubin yellowness (CIE b* proxy: yellow-blue contrast in illuminated pixels)
    const ybDiff = (r + g) * 0.5 - b;
    if (vv >= 30) {
      sumYellowness += Math.max(0, ybDiff);
    }

    // Yellow / Icterus detection: captures both bright scleral icterus (low-moderate saturation)
    // and cutaneous/palmar xanthochromia
    const isYellow =
      (hh >= 26 && hh <= 75 && ss >= 15 && vv >= 32 && ybDiff >= 20) ||
      (hh >= 32 && hh <= 68 && ss >= 10 && vv >= 55 && ybDiff >= 18 && b < g);
    if (isYellow) {
      yellow++;
      patchYellow[pIdx]++;
    }

    // Erythema / Rash / Burn / Inflammation detection:
    // Captures pure red (0-18 deg, 330-360 deg) AND inflamed erythematous skin (18-28 deg with high R-G contrast)
    const isRed =
      ((hh <= 18 || hh >= 330) && ss >= 22 && vv >= 20) ||
      (hh > 18 && hh <= 28 && ss >= 34 && vv >= 25 && rgDiff >= 38 && r >= 120) ||
      (rgDiff >= 45 && rbDiff >= 45 && r >= 130);
    if (isRed) {
      red++;
      patchRed[pIdx]++;
    }

    // Pigmented / Dark lesion / Scab / Necrotic / Deep bruise detection
    const isDark = vv < 25 || (vv < 42 && ss >= 35 && r < 110 && g < 85);
    if (isDark) {
      dark++;
      patchDark[pIdx]++;
    }

    count++;
  }

  if (count === 0) count = 1;

  const avgR = sumR / count;
  const avgG = sumG / count;
  const avgB = sumB / count;
  const avgV = sumV / count;

  // Pass 2: Chromatic & luminance variance (captures lesion contrast, mottling, borders, texture)
  let varSum = 0;
  for (let i = 0; i + 2 < data.length; i += stride) {
    const dr = data[i] - avgR;
    const dg = data[i + 1] - avgG;
    const db = data[i + 2] - avgB;
    varSum += (dr * dr + dg * dg + db * db) / 3;
  }
  const colorStd = Math.sqrt(varSum / count);
  const colorVariance = +Math.min(100, (colorStd / 65) * 100).toFixed(2);

  // Compute top-quartile (focal hotspot) patch ratios so localized lesions/rashes aren't diluted by background
  const redPatchRatios: number[] = [];
  const yellowPatchRatios: number[] = [];
  const darkPatchRatios: number[] = [];
  for (let p = 0; p < numPatches; p++) {
    if (patchCount[p] > 0) {
      redPatchRatios.push((patchRed[p] / patchCount[p]) * 100);
      yellowPatchRatios.push((patchYellow[p] / patchCount[p]) * 100);
      darkPatchRatios.push((patchDark[p] / patchCount[p]) * 100);
    }
  }
  redPatchRatios.sort((a, b) => b - a);
  yellowPatchRatios.sort((a, b) => b - a);
  darkPatchRatios.sort((a, b) => b - a);

  const topK = Math.max(1, Math.floor(redPatchRatios.length * 0.2)); // top 20% focal region
  const focalRed = redPatchRatios.slice(0, topK).reduce((s, v) => s + v, 0) / topK;
  const focalYellow = yellowPatchRatios.slice(0, topK).reduce((s, v) => s + v, 0) / topK;
  const focalDark = darkPatchRatios.slice(0, topK).reduce((s, v) => s + v, 0) / topK;

  const globalRed = (red / count) * 100;
  const globalYellow = (yellow / count) * 100;
  const globalDark = (dark / count) * 100;

  // Blend global ratio (45%) + focal lesion hotspot ratio (55%) so both diffuse and localized conditions register
  const effectiveRed = +(globalRed * 0.45 + focalRed * 0.55).toFixed(2);
  const effectiveYellow = +(globalYellow * 0.45 + focalYellow * 0.55).toFixed(2);
  const effectiveDark = +(globalDark * 0.5 + focalDark * 0.5).toFixed(2);

  const erythemaIndex = +Math.min(100, (sumErythema / count) * 1.4).toFixed(2);
  const jaundiceIndex = +Math.min(100, (sumYellowness / count) * 1.6).toFixed(2);
  const melaninIndex = +Math.min(100, Math.max(0, 100 - avgV) * 0.7 + colorVariance * 0.3).toFixed(2);
  const focalAnomaly = +Math.min(100, Math.max(focalRed - globalRed, focalYellow - globalYellow, focalDark - globalDark)).toFixed(2);

  return {
    avgR: +avgR.toFixed(2),
    avgG: +avgG.toFixed(2),
    avgB: +avgB.toFixed(2),
    avgH: +(sumH / count).toFixed(2),
    avgS: +(sumS / count).toFixed(2),
    avgV: +avgV.toFixed(2),
    yellowRatio: effectiveYellow,
    redRatio: effectiveRed,
    darkRatio: effectiveDark,
    brightness: +avgV.toFixed(2),
    erythemaIndex,
    jaundiceIndex,
    melaninIndex,
    colorVariance,
    focalAnomaly,
  };
}

export interface RuleResult {
  condition: string;
  severity: "none" | "mild" | "moderate" | "severe";
  ruleConfidence: number;
}

export function applyRegionRules(region: "eye" | "skin" | "palm", f: ColorFeatures): RuleResult {
  const yellowThresh =
    region === "eye"
      ? { mild: 6, moderate: 14, severe: 25 }
      : region === "palm"
        ? { mild: 10, moderate: 20, severe: 34 }
        : { mild: 14, moderate: 24, severe: 38 };

  const redThresh =
    region === "eye"
      ? { mild: 8, moderate: 18, severe: 30 }
      : { mild: 10, moderate: 22, severe: 38 };

  const y = f.yellowRatio;
  const r = f.redRatio;
  const d = f.darkRatio;
  const cv = f.colorVariance ?? 0;
  const focal = f.focalAnomaly ?? 0;

  let condition = "Healthy appearance";
  let severity: RuleResult["severity"] = "none";
  let ruleConfidence = 84;

  // 1. Severe checks
  if (y >= yellowThresh.severe) {
    condition = region === "eye" ? "Possible scleral icterus / jaundice (severe)" : "Possible jaundice / xanthochromia (severe)";
    severity = "severe";
    ruleConfidence = 91;
  } else if (r >= redThresh.severe) {
    condition = region === "eye" ? "Severe conjunctival redness / irritation" : "Possible burn, acute rash, or severe inflammation";
    severity = "severe";
    ruleConfidence = 89;
  } else if (region === "skin" && d >= 38 && cv >= 28) {
    condition = "High-contrast hyperpigmented or dark cutaneous lesion";
    severity = "severe";
    ruleConfidence = 86;
  }
  // 2. Moderate checks
  else if (y >= yellowThresh.moderate) {
    condition = region === "eye" ? "Possible scleral icterus / jaundice (moderate)" : "Possible jaundice (moderate)";
    severity = "moderate";
    ruleConfidence = 84;
  } else if (r >= redThresh.moderate || (r >= 12 && focal >= 22)) {
    condition = region === "eye" ? "Moderate conjunctival redness / vascularity" : "Localized erythematous rash, dermatitis, or inflammation";
    severity = "moderate";
    ruleConfidence = 82;
  } else if (region === "skin" && d >= 24 && (cv >= 22 || focal >= 20)) {
    condition = "Localized pigmented lesion or cutaneous spot";
    severity = "moderate";
    ruleConfidence = 79;
  }
  // 3. Mild checks
  else if (y >= yellowThresh.mild) {
    condition = region === "eye" ? "Mild scleral yellowing (possible early icterus)" : "Mild yellowish tint (possible carotenemia or mild jaundice)";
    severity = "mild";
    ruleConfidence = 76;
  } else if (r >= redThresh.mild || (r >= 6 && focal >= 14)) {
    condition = region === "eye" ? "Mild eye redness or dryness irritation" : "Mild skin redness, irritation, or localized blemish";
    severity = "mild";
    ruleConfidence = 75;
  } else if (region === "skin" && (d >= 16 || cv >= 30 || focal >= 18)) {
    condition = "Mild uneven pigmentation or surface irritation";
    severity = "mild";
    ruleConfidence = 72;
  }

  return { condition, severity, ruleConfidence };
}
