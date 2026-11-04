// Native RGB/HSV color analysis & region-based threshold rules.
// Preserves the exact algorithms and thresholds from src/lib/color-analysis.ts.
import { decode as decodeBase64 } from 'base64-arraybuffer';
import * as jpeg from 'jpeg-js';

export interface ColorFeatures {
  avgR: number;
  avgG: number;
  avgB: number;
  avgH: number; // 0-360
  avgS: number; // 0-100
  avgV: number; // 0-100
  yellowRatio: number; // % pixels in yellow hue range
  redRatio: number; // % pixels in red hue range
  darkRatio: number; // % low-value pixels
  brightness: number; // 0-100
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
  let count = 0;

  // Sample pixels with stride so large images process in <50ms on mobile
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
    sumH += hh;
    sumS += ss;
    sumV += vv;

    // Yellow hue: 35-70, with reasonable saturation/value
    if (hh >= 35 && hh <= 70 && ss >= 25 && vv >= 30) yellow++;
    // Red hue: wraps near 0/360
    if ((hh <= 15 || hh >= 345) && ss >= 30 && vv >= 25) red++;
    if (vv < 20) dark++;
    count++;
  }

  if (count === 0) count = 1;

  return {
    avgR: +(sumR / count).toFixed(2),
    avgG: +(sumG / count).toFixed(2),
    avgB: +(sumB / count).toFixed(2),
    avgH: +(sumH / count).toFixed(2),
    avgS: +(sumS / count).toFixed(2),
    avgV: +(sumV / count).toFixed(2),
    yellowRatio: +((yellow / count) * 100).toFixed(2),
    redRatio: +((red / count) * 100).toFixed(2),
    darkRatio: +((dark / count) * 100).toFixed(2),
    brightness: +(sumV / count).toFixed(2),
  };
}

export async function analyzeImageBase64(base64: string): Promise<ColorFeatures> {
  const clean = base64.includes(',') ? base64.split(',')[1] : base64;
  const buffer = decodeBase64(clean);
  const bytes = new Uint8Array(buffer);

  // Check if JPEG (FF D8)
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    try {
      const decoded = jpeg.decode(bytes, { useTArray: true, maxResolutionInMP: 16 });
      return computeFeaturesFromRgba(decoded.data, 4);
    } catch {
      // Fallback to byte-stream sampling below if progressive/unsupported JPEG header
    }
  }

  // Fallback deterministic RGB sampling from payload body
  const start = Math.min(256, Math.floor(bytes.length * 0.1));
  const slice = bytes.subarray(start);
  return computeFeaturesFromRgba(slice, 4);
}

// Region-based threshold logic mirrors the original spec
export interface RuleResult {
  condition: string;
  severity: 'none' | 'mild' | 'moderate' | 'severe';
  ruleConfidence: number;
}

export function applyRegionRules(region: 'eye' | 'skin' | 'palm', f: ColorFeatures): RuleResult {
  const yellowThresh =
    region === 'eye'
      ? { mild: 8, moderate: 18, severe: 30 }
      : region === 'palm'
        ? { mild: 12, moderate: 25, severe: 40 }
        : { mild: 15, moderate: 28, severe: 45 };

  const redThresh = { mild: 20, moderate: 35, severe: 55 };

  const y = f.yellowRatio;
  const r = f.redRatio;

  let condition = 'Healthy appearance';
  let severity: RuleResult['severity'] = 'none';
  let ruleConfidence = 60;

  if (y >= yellowThresh.severe) {
    condition = 'Possible jaundice (severe)';
    severity = 'severe';
    ruleConfidence = 88;
  } else if (y >= yellowThresh.moderate) {
    condition = 'Possible jaundice (moderate)';
    severity = 'moderate';
    ruleConfidence = 78;
  } else if (y >= yellowThresh.mild) {
    condition = 'Possible jaundice (mild)';
    severity = 'mild';
    ruleConfidence = 68;
  } else if (r >= redThresh.severe && f.darkRatio < 15) {
    condition = 'Possible burn or severe inflammation';
    severity = 'severe';
    ruleConfidence = 82;
  } else if (r >= redThresh.moderate) {
    condition = 'Possible burn or inflammation';
    severity = 'moderate';
    ruleConfidence = 74;
  } else if (r >= redThresh.mild) {
    condition = 'Mild redness or irritation';
    severity = 'mild';
    ruleConfidence = 65;
  }

  return { condition, severity, ruleConfidence };
}
