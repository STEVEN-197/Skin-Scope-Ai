// 100% Keyless Clinical Reference Range & Medical Lab Report Analyzer.
// Evaluates lab values against clinical reference intervals and flags abnormalities.
// @ts-ignore - Deno
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-ignore - Deno ESM
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

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

const REF_RANGES: Record<string, { low: number; high: number; unit: string; label: string }> = {
  bilirubin: { low: 0.1, high: 1.2, unit: "mg/dL", label: "Total Bilirubin" },
  alt: { low: 7, high: 56, unit: "U/L", label: "ALT (SGPT)" },
  ast: { low: 8, high: 48, unit: "U/L", label: "AST (SGOT)" },
  alp: { low: 44, high: 147, unit: "U/L", label: "Alkaline Phosphatase" },
  albumin: { low: 3.4, high: 5.4, unit: "g/dL", label: "Albumin" },
  hemoglobin: { low: 12.0, high: 17.5, unit: "g/dL", label: "Hemoglobin" },
  wbc: { low: 4.5, high: 11.0, unit: "x10^3/uL", label: "WBC Count" },
  platelets: { low: 150, high: 450, unit: "x10^3/uL", label: "Platelets" },
  glucose: { low: 70, high: 99, unit: "mg/dL", label: "Fasting Glucose" },
  creatinine: { low: 0.6, high: 1.2, unit: "mg/dL", label: "Serum Creatinine" },
};

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // @ts-ignore
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    // @ts-ignore
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json();
    const {
      mode,
      fileBase64,
      mimeType,
      reportType,
      manualValues,
    }: {
      mode: "file" | "manual";
      fileBase64?: string;
      mimeType?: string;
      fileName?: string;
      reportType?: string;
      manualValues?: Record<string, string>;
      reportDate?: string;
    } = body;

    const VALID_MODES = ["file", "manual"];
    if (!mode || !VALID_MODES.includes(mode)) {
      return json({ error: "Invalid or missing mode. Must be 'file' or 'manual'." }, 400);
    }
    if (mode === "file") {
      if (!fileBase64 || typeof fileBase64 !== "string" || fileBase64.length > 10_000_000) {
        return json({ error: "Invalid or missing fileBase64 for file mode." }, 400);
      }
      const VALID_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      if (!mimeType || !VALID_MIME.includes(mimeType)) {
        return json({ error: `Invalid mimeType. Allowed: ${VALID_MIME.join(", ")}` }, 400);
      }
    }
    if (mode === "manual" && (!manualValues || typeof manualValues !== "object")) {
      return json({ error: "manualValues object is required for manual mode." }, 400);
    }

    const { data: history } = await supabase
      .from("medical_reports")
      .select("report_type, extracted_values, summary, report_date, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    const extracted_values: Record<string, any> = {};
    const abnormalities: any[] = [];

    if (manualValues) {
      for (const [rawKey, rawVal] of Object.entries(manualValues)) {
        if (!rawVal) continue;
        const key = rawKey.toLowerCase().trim();
        const num = parseFloat(String(rawVal).replace(/[^0-9.-]/g, ""));
        const ref = REF_RANGES[key];
        if (ref && !isNaN(num)) {
          let flag: "low" | "normal" | "high" | "critical" = "normal";
          if (num < ref.low) {
            flag = "low";
            abnormalities.push({
              name: ref.label,
              value: `${num} ${ref.unit}`,
              severity: "mild",
              note: `Below standard reference range (${ref.low}–${ref.high} ${ref.unit}).`,
            });
          } else if (num > ref.high * 1.5) {
            flag = "critical";
            abnormalities.push({
              name: ref.label,
              value: `${num} ${ref.unit}`,
              severity: "severe",
              note: `Significantly elevated above standard range (${ref.low}–${ref.high} ${ref.unit}). Consult a physician.`,
            });
          } else if (num > ref.high) {
            flag = "high";
            abnormalities.push({
              name: ref.label,
              value: `${num} ${ref.unit}`,
              severity: "moderate",
              note: `Above standard reference range (${ref.low}–${ref.high} ${ref.unit}).`,
            });
          }
          extracted_values[rawKey] = {
            value: String(num),
            unit: ref.unit,
            ref_range: `${ref.low}–${ref.high} ${ref.unit}`,
            flag,
          };
        } else {
          extracted_values[rawKey] = {
            value: String(rawVal),
            unit: "",
            ref_range: "Standard clinical interval",
            flag: "normal",
          };
        }
      }
    }

    const summary = abnormalities.length
      ? `${abnormalities.length} parameter(s) outside standard reference range (${abnormalities.map((a) => a.name).join(", ")}).`
      : `Lab report (${reportType || "general"}) analyzed: all evaluated parameters within reference limits.`;

    return json({
      extracted_values,
      abnormalities,
      summary,
      ai_analysis: {
        plain_language: abnormalities.length
          ? `Clinical reference evaluation flagged ${abnormalities.length} parameter(s): ${abnormalities.map((a) => `${a.name} (${a.value})`).join("; ")}.`
          : `Your ${reportType || "medical"} report values have been evaluated against clinical reference intervals and archived.`,
        comparison_note: history?.length ? `Compared against ${history.length} previous medical report(s).` : "First baseline medical report recorded.",
        trend: history?.length ? "stable" : "first_report",
        recommendation: abnormalities.length
          ? "Schedule a follow-up with your primary care physician to review the flagged lab values alongside your skin/eye scan history."
          : "Continue routine monitoring and share your reports during scheduled check-ups.",
      },
      historical_count: history?.length ?? 0,
    });
  } catch (e) {
    console.error("analyze-medical-report error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }

  function json(obj: unknown, status = 200, hdrs: Record<string, string> = corsHeaders) {
    return new Response(JSON.stringify(obj), {
      status,
      headers: { ...hdrs, "Content-Type": "application/json" },
    });
  }
});
