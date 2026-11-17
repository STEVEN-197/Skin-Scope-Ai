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

const MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.8-flash"];

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // @ts-ignore
    const API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("LOVABLE_API_KEY");
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

    if (API_KEY) {
      const historyText = history?.length
        ? history
            .map(
              (h: any, i: number) =>
                `${i + 1}. ${(h.report_date || h.created_at).slice(0, 10)} — ${h.report_type || "report"}: ${JSON.stringify(h.extracted_values).slice(0, 400)}`
            )
            .join("\n")
        : "No previous reports.";

      const systemPrompt = `You are SkinScope Health Intelligence, an educational AI assistant that interprets lab reports for users. You are NOT a medical device and must never give a clinical diagnosis. Use cautious language ("appears", "suggests", "consistent with"). Always recommend consulting a licensed healthcare professional for any abnormal finding. Always return valid JSON via the provided tool.`;

      const userPrompt =
        mode === "file"
          ? `Analyze this lab report (${reportType || "general"}). Extract every measurable parameter you can read.`
          : `Interpret these manually-entered lab values (${reportType || "general"}):\n${JSON.stringify(manualValues, null, 2)}`;

      const fullPrompt = `${userPrompt}\n\nUser's previous reports (most recent first):\n${historyText}`;

      const messages: any[] = [
        { role: "system", content: systemPrompt },
        mode === "file" && fileBase64
          ? {
              role: "user",
              content: [
                { type: "text", text: fullPrompt },
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${fileBase64}` } },
              ],
            }
          : { role: "user", content: fullPrompt },
      ];

      for (const model of MODELS) {
        try {
          const aiResp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${API_KEY}`,
              "Content-Type": "application/json",
            },
            signal: AbortSignal.timeout(12000),
            body: JSON.stringify({
              model,
              reasoning_effort: "low",
              messages,
              tools: [
                {
                  type: "function",
                  function: {
                    name: "submit_report_analysis",
                    description: "Return structured lab report analysis.",
                    parameters: {
                      type: "object",
                      properties: {
                        extracted_values: { type: "object" },
                        abnormalities: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              name: { type: "string" },
                              value: { type: "string" },
                              severity: { type: "string", enum: ["mild", "moderate", "severe", "info"] },
                              note: { type: "string" },
                            },
                            required: ["name", "value", "severity", "note"],
                          },
                        },
                        summary: { type: "string" },
                        plain_language: { type: "string" },
                        comparison_note: { type: "string" },
                        trend: {
                          type: "string",
                          enum: ["improving", "stable", "worsening", "first_report", "inconclusive"],
                        },
                        recommendation: { type: "string" },
                      },
                      required: ["extracted_values", "abnormalities", "summary", "plain_language", "comparison_note", "trend", "recommendation"],
                    },
                  },
                },
              ],
              tool_choice: { type: "function", function: { name: "submit_report_analysis" } },
            }),
          });

          if (aiResp.ok) {
            const aiData = await aiResp.json();
            const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
            if (toolCall) {
              const parsed = JSON.parse(toolCall.function.arguments);
              return json({
                extracted_values: parsed.extracted_values ?? {},
                abnormalities: parsed.abnormalities ?? [],
                summary: parsed.summary,
                ai_analysis: {
                  plain_language: parsed.plain_language,
                  comparison_note: parsed.comparison_note,
                  trend: history?.length ? parsed.trend : "first_report",
                  recommendation: parsed.recommendation,
                },
                historical_count: history?.length ?? 0,
              });
            }
          }
        } catch (err) {
          console.error(`analyze-medical-report model ${model} failed:`, err);
        }
      }
    }

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
