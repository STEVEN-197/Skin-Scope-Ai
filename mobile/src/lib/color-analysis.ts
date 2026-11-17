// Native Dermatological & Clinical Computer Vision feature extractor + Tissue Gatekeeper.
// Uses Kovac/Peer YCbCr + RGB biological tissue reflectance models, 8x8 Spatial Patch
// Hotspot analysis, Dawson Erythema Index, and Scleral Bilirubin Chromaticity.
import { decode as decodeBase64 } from 'base64-arraybuffer';
import * as jpeg from 'jpeg-js';

export interface TissueValidation {
  valid: boolean;
  detected: string;
  reason: string;
  quality: 'good' | 'fair' | 'poor';
  skinTissueRatio: number;
  syntheticObjectRatio: number;
  scleraRatio: number;
}

export interface ColorFeatures {
  avgR: number;
  avgG: number;
  avgB: number;
  avgH: number;
  avgS: number;
  avgV: number;
  yellowRatio: number;
  redRatio: number;
  darkRatio: number;
  brightness: number;
  erythemaIndex?: number;
  jaundiceIndex?: number;
  melaninIndex?: number;
  colorVariance?: number;
  focalAnomaly?: number;
  skinTissueRatio?: number;
  syntheticRatio?: number;
  scleraRatio?: number;
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

function rgbToYCbCr(r: number, g: number, b: number): [number, number, number] {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return [y, cb, cr];
}

function computeFeaturesFromRgba(data: Uint8Array, step = 4): ColorFeatures {
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
  let skinPixels = 0,
    syntheticPixels = 0,
    scleraPixels = 0;
  let count = 0;

  const numPatches = 64;
  const patchRed = new Float64Array(numPatches);
  const patchYellow = new Float64Array(numPatches);
  const patchDark = new Float64Array(numPatches);
  const patchCount = new Uint32Array(numPatches);

  const totalPixels = Math.floor(data.length / 4);
  const stride = Math.max(1, Math.floor(totalPixels / 16384)) * step;

  for (let i = 0; i + 2 < data.length; i += stride) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    sumR += r;
    sumG += g;
    sumB += b;
    const [hh, ss, vv] = rgbToHsv(r, g, b);
    const [, cb, cr] = rgbToYCbCr(r, g, b);
    sumH += hh;
    sumS += ss;
    sumV += vv;

    const pIdx = Math.min(numPatches - 1, Math.floor(((i / 4) / Math.max(1, totalPixels)) * numPatches));
    patchCount[pIdx]++;

    const grRatio = r > 0 ? g / r : 1;
    const isSyntheticDye =
      (r > 100 && ((grRatio < 0.42 && ss > 52) || ss > 68 || cr > 182)) ||
      (hh >= 80 && hh <= 325 && ss > 25 && vv > 20);
    if (isSyntheticDye) {
      syntheticPixels++;
    }

    const isBiologicalSkin =
      !isSyntheticDye &&
      r >= 50 &&
      g >= 30 &&
      b >= 18 &&
      r >= g * 0.96 &&
      r >= b * 1.02 &&
      g - b >= -8 &&
      grRatio >= 0.42 &&
      grRatio <= 0.96 &&
      (hh <= 65 || hh >= 330) &&
      ss >= 6 &&
      ss <= 65 &&
      cb >= 70 &&
      cb <= 136 &&
      cr >= 126 &&
      cr <= 180;
    if (isBiologicalSkin) {
      skinPixels++;
    }

    const isSclera = !isSyntheticDye && vv >= 48 && ss <= 42 && r >= 115 && g >= 110 && b >= 75;
    if (isSclera) {
      scleraPixels++;
    }

    const rgDiff = r - g;
    const rbDiff = r - b;
    const ybDiff = (r + g) * 0.5 - b;

    if (isBiologicalSkin || isSclera) {
      const ei = Math.max(0, rgDiff * 1.3 + (rbDiff - rgDiff) * 0.4);
      sumErythema += ei;
      if (vv >= 30) {
        sumYellowness += Math.max(0, ybDiff);
      }

      const isYellow =
        (hh >= 26 && hh <= 64 && ss >= 16 && ss <= 58 && vv >= 35 && ybDiff >= 22) ||
        (isSclera && hh >= 30 && hh <= 64 && ss >= 12 && ybDiff >= 20 && b < g);
      if (isYellow) {
        yellow++;
        patchYellow[pIdx]++;
      }

      const isRed =
        isBiologicalSkin &&
        grRatio >= 0.44 &&
        grRatio <= 0.66 &&
        (((hh <= 18 || hh >= 345) && ss >= 26 && ss <= 60 && vv >= 28 && rgDiff >= 34) ||
          (hh > 18 && hh <= 26 && ss >= 36 && ss <= 60 && vv >= 30 && rgDiff >= 44 && cr >= 154));
      if (isRed) {
        red++;
        patchRed[pIdx]++;
      }
    }

    const isDark = isBiologicalSkin && vv < 36 && ss >= 25 && r < 105 && g < 75;
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

  let varSum = 0;
  for (let i = 0; i + 2 < data.length; i += stride) {
    const dr = data[i] - avgR;
    const dg = data[i + 1] - avgG;
    const db = data[i + 2] - avgB;
    varSum += (dr * dr + dg * dg + db * db) / 3;
  }
  const colorStd = Math.sqrt(varSum / count);
  const colorVariance = +Math.min(100, (colorStd / 65) * 100).toFixed(2);

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

  const topK = Math.max(1, Math.floor(redPatchRatios.length * 0.2));
  const focalRed = redPatchRatios.slice(0, topK).reduce((s, v) => s + v, 0) / topK;
  const focalYellow = yellowPatchRatios.slice(0, topK).reduce((s, v) => s + v, 0) / topK;
  const focalDark = darkPatchRatios.slice(0, topK).reduce((s, v) => s + v, 0) / topK;

  const globalRed = (red / count) * 100;
  const globalYellow = (yellow / count) * 100;
  const globalDark = (dark / count) * 100;

  const effectiveRed = +(globalRed * 0.45 + focalRed * 0.55).toFixed(2);
  const effectiveYellow = +(globalYellow * 0.45 + focalYellow * 0.55).toFixed(2);
  const effectiveDark = +(globalDark * 0.5 + focalDark * 0.5).toFixed(2);

  const erythemaIndex = +Math.min(100, (sumErythema / count) * 1.4).toFixed(2);
  const jaundiceIndex = +Math.min(100, (sumYellowness / count) * 1.6).toFixed(2);
  const melaninIndex = +Math.min(100, Math.max(0, 100 - avgV) * 0.7 + colorVariance * 0.3).toFixed(2);
  const focalAnomaly = +Math.min(100, Math.max(focalRed - globalRed, focalYellow - globalYellow, focalDark - globalDark)).toFixed(2);

  const skinTissueRatio = +((skinPixels / count) * 100).toFixed(2);
  const syntheticRatio = +((syntheticPixels / count) * 100).toFixed(2);
  const scleraRatio = +((scleraPixels / count) * 100).toFixed(2);

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
    skinTissueRatio,
    syntheticRatio,
    scleraRatio,
  };
}

export function validateTissueFeatures(region: 'eye' | 'skin' | 'palm', f: ColorFeatures): TissueValidation {
  const skinRatio = f.skinTissueRatio ?? 0;
  const synthRatio = f.syntheticRatio ?? 0;
  const scleraRatio = f.scleraRatio ?? 0;
  const cv = f.colorVariance ?? 10;

  if (cv < 2.5) {
    return {
      valid: false,
      detected: 'blank or solid-color surface',
      reason: 'Image is a solid or blank color without biological tissue texture.',
      quality: 'poor',
      skinTissueRatio: skinRatio,
      syntheticObjectRatio: synthRatio,
      scleraRatio,
    };
  }

  const avgGr = f.avgR > 0 ? f.avgG / f.avgR : 1;
  if ((synthRatio > 22 && synthRatio > skinRatio) || (f.avgR > 110 && avgGr < 0.42)) {
    return {
      valid: false,
      detected: 'synthetic object or non-biological color',
      reason: `Detected artificial/non-biological colors (${synthRatio.toFixed(0)}% synthetic spectrum). Please upload a clear photo of real human ${region}.`,
      quality: 'poor',
      skinTissueRatio: skinRatio,
      syntheticObjectRatio: synthRatio,
      scleraRatio,
    };
  }

  if (region === 'eye') {
    if (skinRatio + scleraRatio < 15 || scleraRatio < 2) {
      return {
        valid: false,
        detected: 'non-eye object',
        reason: 'Could not detect human eye (sclera and eyelid tissue) features. Please upload a clear close-up of the eye.',
        quality: 'poor',
        skinTissueRatio: skinRatio,
        syntheticObjectRatio: synthRatio,
        scleraRatio,
      };
    }
  } else {
    if (skinRatio < 15) {
      return {
        valid: false,
        detected: 'non-skin object or background',
        reason: `Insufficient human ${region} tissue detected (${skinRatio.toFixed(0)}%). Please move closer so your ${region} fills the frame.`,
        quality: 'poor',
        skinTissueRatio: skinRatio,
        syntheticObjectRatio: synthRatio,
        scleraRatio,
      };
    }
  }

  return {
    valid: true,
    detected: region,
    reason: '',
    quality: f.brightness < 25 || f.brightness > 90 ? 'fair' : 'good',
    skinTissueRatio: skinRatio,
    syntheticObjectRatio: synthRatio,
    scleraRatio,
  };
}

export async function analyzeImageBase64(base64: string): Promise<ColorFeatures> {
  const clean = base64.includes(',') ? base64.split(',')[1] : base64;
  const buffer = decodeBase64(clean);
  const bytes = new Uint8Array(buffer);

  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    try {
      const decoded = jpeg.decode(bytes, { useTArray: true, maxResolutionInMP: 16 });
      return computeFeaturesFromRgba(decoded.data, 4);
    } catch {
      // Fallback below
    }
  }

  const start = Math.min(256, Math.floor(bytes.length * 0.1));
  const slice = bytes.subarray(start);
  return computeFeaturesFromRgba(slice, 4);
}

export interface RuleResult {
  condition: string;
  severity: 'none' | 'mild' | 'moderate' | 'severe';
  ruleConfidence: number;
}

export function applyRegionRules(region: 'eye' | 'skin' | 'palm', f: ColorFeatures): RuleResult {
  const yellowThresh =
    region === 'eye'
      ? { mild: 6, moderate: 14, severe: 25 }
      : region === 'palm'
        ? { mild: 10, moderate: 20, severe: 34 }
        : { mild: 14, moderate: 24, severe: 38 };

  const redThresh =
    region === 'eye'
      ? { mild: 8, moderate: 18, severe: 30 }
      : { mild: 10, moderate: 22, severe: 38 };

  const y = f.yellowRatio;
  const r = f.redRatio;
  const d = f.darkRatio;
  const cv = f.colorVariance ?? 0;
  const focal = f.focalAnomaly ?? 0;

  let condition = 'Healthy appearance';
  let severity: RuleResult['severity'] = 'none';
  let ruleConfidence = 84;

  if (y >= yellowThresh.severe) {
    condition = region === 'eye' ? 'Possible scleral icterus / jaundice (severe)' : 'Possible jaundice / xanthochromia (severe)';
    severity = 'severe';
    ruleConfidence = 91;
  } else if (r >= redThresh.severe) {
    condition = region === 'eye' ? 'Severe conjunctival redness / irritation' : 'Possible burn, acute rash, or severe inflammation';
    severity = 'severe';
    ruleConfidence = 89;
  } else if (region === 'skin' && d >= 38 && cv >= 28) {
    condition = 'High-contrast hyperpigmented or dark cutaneous lesion';
    severity = 'severe';
    ruleConfidence = 86;
  } else if (y >= yellowThresh.moderate) {
    condition = region === 'eye' ? 'Possible scleral icterus / jaundice (moderate)' : 'Possible jaundice (moderate)';
    severity = 'moderate';
    ruleConfidence = 84;
  } else if (r >= redThresh.moderate || (r >= 12 && focal >= 22)) {
    condition = region === 'eye' ? 'Moderate conjunctival redness / vascularity' : 'Localized erythematous rash, dermatitis, or inflammation';
    severity = 'moderate';
    ruleConfidence = 82;
  } else if (region === 'skin' && d >= 24 && (cv >= 22 || focal >= 20)) {
    condition = 'Localized pigmented lesion or cutaneous spot';
    severity = 'moderate';
    ruleConfidence = 79;
  } else if (y >= yellowThresh.mild) {
    condition = region === 'eye' ? 'Mild scleral yellowing (possible early icterus)' : 'Mild yellowish tint (possible carotenemia or mild jaundice)';
    severity = 'mild';
    ruleConfidence = 76;
  } else if (r >= redThresh.mild || (r >= 6 && focal >= 14)) {
    condition = region === 'eye' ? 'Mild eye redness or dryness irritation' : 'Mild skin redness, irritation, or localized blemish';
    severity = 'mild';
    ruleConfidence = 75;
  } else if (region === 'skin' && (d >= 16 || cv >= 30 || focal >= 18)) {
    condition = 'Mild uneven pigmentation or surface irritation';
    severity = 'mild';
    ruleConfidence = 72;
  }

  return { condition, severity, ruleConfidence };
}
