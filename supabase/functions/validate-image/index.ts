// 100% Keyless Biological Tissue Gatekeeper (JPEG + PNG + Client Features).
// Supports pale/rosy/pinkish/tan/brown human palms, skin, and eyes while
// rejecting synthetic plastic/paint objects (e.g. red/blue buckets).
// @ts-ignore
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
// @ts-ignore
import jpeg from "https://esm.sh/jpeg-js@0.4.4";
// @ts-ignore
import UPNG from "https://esm.sh/upng-js@2.1.0";

const ALLOWED_ORIGINS = [
  "https://skinscopeai-main.vercel.app",
  "https://skinscopeai.vercel.app",
  "http://localhost:8080",
  "http://localhost:8081",
  "http://localhost:5173",
  "http://localhost:4173",
  "capacitor://localhost",
];

const ALLOWED_ORIGIN_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https?:\/\/(10|172\.(1[6-9]|2\d|3[01])|192\.168)\.\d+\.\d+(:\d+)?$/,
  /^https:\/\/[a-z0-9-]+\.vercel\.app$/,
];

function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGIN_PATTERNS.some((p) => p.test(origin));
}

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowedOrigin = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  const requested = req.headers.get("access-control-request-headers");
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      requested ||
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
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

function validateRgbaPixels(data: Uint8Array, region: string) {
  let skinPixels = 0, syntheticPixels = 0, scleraPixels = 0, count = 0;
  let sumR = 0, sumG = 0, sumB = 0;

  const totalPixels = Math.floor(data.length / 4);
  const stride = Math.max(1, Math.floor(totalPixels / 12000)) * 4;

  for (let i = 0; i + 2 < data.length; i += stride) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    sumR += r; sumG += g; sumB += b;
    const [hh, ss, vv] = rgbToHsv(r, g, b);
    const [, cb, cr] = rgbToYCbCr(r, g, b);

    const grRatio = r > 0 ? g / r : 1;
    const isSyntheticDye =
      (r > 100 && ((grRatio < 0.42 && ss > 52) || ss > 68 || cr > 182)) ||
      (hh >= 80 && hh <= 325 && ss > 25 && vv > 20);
    if (isSyntheticDye) syntheticPixels++;

    const isBiologicalSkin =
      !isSyntheticDye &&
      r >= 50 && g >= 30 && b >= 18 &&
      r >= g * 0.96 && r >= b * 1.02 &&
      g - b >= -8 &&
      grRatio >= 0.42 && grRatio <= 0.96 &&
      (hh <= 65 || hh >= 330) &&
      ss >= 6 && ss <= 65 &&
      cb >= 70 && cb <= 136 && cr >= 126 && cr <= 180;
    if (isBiologicalSkin) skinPixels++;

    const isSclera = !isSyntheticDye && vv >= 48 && ss <= 42 && r >= 115 && g >= 110 && b >= 75;
    if (isSclera) scleraPixels++;

    count++;
  }

  if (count === 0) return { valid: true, detected: region, reason: "", quality: "good" };
  const mR = sumR / count, mG = sumG / count, mB = sumB / count;
  let varSum = 0;
  for (let i = 0; i + 2 < data.length; i += stride) {
    varSum += ((data[i] - mR) ** 2 + (data[i + 1] - mG) ** 2 + (data[i + 2] - mB) ** 2) / 3;
  }
  const std = Math.sqrt(varSum / count);
  const skinRatio = (skinPixels / count) * 100;
  const synthRatio = (syntheticPixels / count) * 100;
  const scleraRatio = (scleraPixels / count) * 100;

  if (std < 2.0) {
    return {
      valid: false,
      detected: "blank or uniform color surface",
      reason: "Image is a solid or blank color without biological tissue texture.",
      quality: "poor",
    };
  }

  const avgGr = mR > 0 ? mG / mR : 1;
  if ((synthRatio > 22 && synthRatio > skinRatio) || (mR > 110 && avgGr < 0.42)) {
    return {
      valid: false,
      detected: "synthetic object or non-biological color",
      reason: `Detected artificial/non-biological object (${synthRatio.toFixed(0)}% synthetic spectrum). Please upload a clear photo of real human ${region}.`,
      quality: "poor",
    };
  }

  if (region === "eye") {
    if (skinRatio + scleraRatio < 15 || scleraRatio < 2) {
      return {
        valid: false,
        detected: "non-eye object",
        reason: "Could not detect human eye (sclera and eyelid skin) features. Please upload a clear close-up of the eye.",
        quality: "poor",
      };
    }
  } else {
    if (skinRatio < 15) {
      return {
        valid: false,
        detected: "non-skin object",
        reason: `Insufficient human ${region} tissue detected (${skinRatio.toFixed(0)}%). Please move closer so your ${region} fills the frame.`,
        quality: "poor",
      };
    }
  }

  return { valid: true, detected: region, reason: "", quality: "good" };
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return j({ error: "Missing authorization header" }, 401, corsHeaders);
    }

    // @ts-ignore
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    // @ts-ignore
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u, error: authErr } = await supabase.auth.getUser();
    if (authErr || !u?.user) {
      return j({ error: "Unauthorized" }, 401, corsHeaders);
    }

    const body = await req.json();
    const { imageBase64, region, colorFeatures } = body;
    const VALID_REGIONS = ["skin", "face", "eye", "palm"];
    if (!imageBase64 || typeof imageBase64 !== "string" || imageBase64.length > 5_000_000) {
      return j({ error: "Invalid or missing imageBase64" }, 400, corsHeaders);
    }
    if (!region || !VALID_REGIONS.includes(region)) {
      return j({ error: `Invalid region. Must be one of: ${VALID_REGIONS.join(", ")}` }, 400, corsHeaders);
    }

    if (colorFeatures) {
      if (colorFeatures.detectedObject) {
        return j({
          valid: false,
          detected: colorFeatures.detectedObject,
          reason: `Identified non-human object (${colorFeatures.detectedObject}). Please upload a clear photo of real human ${region}.`,
          quality: "poor",
        }, 200, corsHeaders);
      }
      if (typeof colorFeatures.skinTissueRatio === "number") {
        const skinRatio = colorFeatures.skinTissueRatio;
        const synthRatio = colorFeatures.syntheticRatio ?? 0;
        const scleraRatio = colorFeatures.scleraRatio ?? 0;
        if (synthRatio > 22 && synthRatio > skinRatio) {
          return j({
            valid: false,
            detected: "synthetic object or non-biological color",
            reason: `Detected artificial/non-biological object (${synthRatio.toFixed(0)}% synthetic spectrum). Please upload a clear photo of real human ${region}.`,
            quality: "poor",
          }, 200, corsHeaders);
        }
        if (region === "eye" && (skinRatio + scleraRatio < 15 || scleraRatio < 2)) {
          return j({
            valid: false,
            detected: "non-eye object",
            reason: "Could not detect human eye (sclera and eyelid skin) features.",
            quality: "poor",
          }, 200, corsHeaders);
        }
        if (region !== "eye" && skinRatio < 15) {
          return j({
            valid: false,
            detected: "non-skin object",
            reason: `Insufficient human ${region} tissue detected (${skinRatio.toFixed(0)}%). Please upload a clear photo of human ${region}.`,
            quality: "poor",
          }, 200, corsHeaders);
        }
      }
    }

    const bytes = base64ToBytes(imageBase64);
    if (bytes.length < 300) {
      return j({ valid: true, detected: region, reason: "", quality: "good" }, 200, corsHeaders);
    }

    if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      try {
        const decoded = jpeg.decode(bytes, { useTArray: true, maxResolutionInMP: 16 });
        return j(validateRgbaPixels(decoded.data, region), 200, corsHeaders);
      } catch {
        // fallback below
      }
    }

    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      try {
        const img = UPNG.decode(bytes.buffer);
        const rgba = new Uint8Array(UPNG.toRGBA8(img)[0]);
        return j(validateRgbaPixels(rgba, region), 200, corsHeaders);
      } catch {
        // fallback below
      }
    }

    return j({ valid: true, detected: region, reason: "", quality: "good" }, 200, corsHeaders);
  } catch (e) {
    return j({ error: e instanceof Error ? e.message : "Unknown" }, 500, corsHeaders);
  }

  function j(o: unknown, status = 200, headers: Record<string, string> = {}) {
    return new Response(JSON.stringify(o), {
      status,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
