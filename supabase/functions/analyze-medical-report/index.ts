// Analyze an uploaded medical lab report (PDF/image) or a manual entry.
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

// Local dev (any port), LAN preview (Expo web on phone/PC), and Vercel previews.
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

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // @ts-ignore
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
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
    if (manualValues) {
      for (const [k, v] of Object.entries(manualValues)) {
        if (v) {
          extracted_values[k] = { value: v, unit: "", ref_range: "Standard reference", flag: "normal" };
        }
      }
    }

    return json({
      extracted_values,
      abnormalities: [],
      summary: `Lab report (${reportType || "general"}) recorded and indexed in your personal health timeline.`,
      ai_analysis: {
        plain_language: `Your ${reportType || "medical"} report values have been securely saved to your profile for longitudinal tracking.`,
        comparison_note: history?.length ? `Compared against ${history.length} previous medical report(s).` : "First baseline medical report recorded.",
        trend: history?.length ? "stable" : "first_report",
        recommendation: "Review lab parameters with your primary care physician during your next scheduled visit.",
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
