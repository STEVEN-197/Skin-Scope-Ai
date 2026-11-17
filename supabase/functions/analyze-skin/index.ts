// AI vision analysis edge function.
// Combines a Lovable AI (Gemini) multimodal call with the client-supplied
// color features and historical reports to produce a structured assessment.

// @ts-ignore - Deno
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-ignore - Deno ESM import
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

// SECURITY FIX (FINDING-004): Restrict CORS to known production origins only.
const ALLOWED_ORIGINS = [
  "https://skinscopeai-main.vercel.app",
  "https://skinscopeai.vercel.app",
  "http://localhost:8080",
  "http://localhost:8081",
  "http://localhost:5173",
  "http://localhost:4173",
  "capacitor://localhost",
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

interface ColorFeatures {
  yellowRatio: number;
  redRatio: number;
  darkRatio: number;
  brightness: number;
  avgR: number;
  avgG: number;
  avgB: number;
}

interface RuleResult {
  condition: string;
  severity: "none" | "mild" | "moderate" | "severe";
  ruleConfidence: number;
}

interface HistoryItem {
  condition: string;
  severity: string;
  confidence: number;
  created_at: string;
}

const SEVERITY_SCORE: Record<string, number> = {
  none: 0,
  mild: 1,
  moderate: 2,
  severe: 3,
};

function severityFromScore(s: number): "none" | "mild" | "moderate" | "severe" {
  if (s >= 2.5) return "severe";
  if (s >= 1.5) return "moderate";
  if (s >= 0.5) return "mild";
  return "none";
}

function buildFallbackAssessment(
  region: "eye" | "skin" | "palm",
  colorFeatures: ColorFeatures,
  ruleResult: RuleResult,
  histArr: HistoryItem[]
) {
  const lightingNote =
    colorFeatures.brightness < 25
      ? "Lighting appears somewhat dim; capturing in natural daylight can improve precision."
      : colorFeatures.brightness > 85
      ? "Image brightness is high; avoiding direct flash glare helps preserve subtle color tones."
      : "Image illumination and chromatic balance are within optimal diagnostic parameters.";

  const observations = `Chromatographic analysis of the ${region} region measured ${colorFeatures.yellowRatio}% yellow-spectrum pixels, ${colorFeatures.redRatio}% erythema/red-spectrum pixels, and ${colorFeatures.darkRatio}% hyperpigmentation/dark pixels (average RGB: ${colorFeatures.avgR}, ${colorFeatures.avgG}, ${colorFeatures.avgB}). Visually consistent with ${ruleResult.condition.toLowerCase()}. ${lightingNote}`;

  let trend: "improving" | "stable" | "worsening" | "first_report" = "first_report";
  let trend_note = "Baseline wellness scan recorded for longitudinal tracking.";
  if (histArr.length > 0) {
    const prevScore = SEVERITY_SCORE[histArr[0].severity] ?? 0;
    const currScore = SEVERITY_SCORE[ruleResult.severity] ?? 0;
    if (currScore < prevScore) {
      trend = "improving";
      trend_note = `Severity indicators show improvement compared to your previous scan (${histArr[0].condition}, ${histArr[0].severity}).`;
    } else if (currScore > prevScore) {
      trend = "worsening";
      trend_note = `Color intensity markers appear elevated compared to your most recent scan (${histArr[0].severity}).`;
    } else {
      trend = "stable";
      trend_note = `Visual color markers remain consistent with your recent ${histArr[0].severity} baseline.`;
    }
  }

  const recommendation =
    ruleResult.severity === "none"
      ? "No concerning chromatic indicators detected. Maintain regular hydration, sun protection, and routine self-monitoring."
      : ruleResult.severity === "mild"
      ? `Mild ${ruleResult.condition.toLowerCase()} indicators observed. Monitor changes over the next 48–72 hours under consistent daylight, stay well hydrated, and consult a healthcare professional if symptoms persist.`
      : `Noticeable ${ruleResult.condition.toLowerCase()} markers detected. Because SkinScope AI is an educational wellness tool and not a medical device, we recommend scheduling an evaluation with a licensed dermatologist or physician.`;

  return {
    condition: ruleResult.condition,
    severity: ruleResult.severity,
    confidence: ruleResult.ruleConfidence || 82,
    observations,
    trend,
    trend_note,
    recommendation,
  };
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // @ts-ignore
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    // @ts-ignore
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    // @ts-ignore
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      imageBase64,
      region,
      colorFeatures,
      ruleResult,
    }: {
      imageBase64: string;
      region: "eye" | "skin" | "palm";
      colorFeatures: ColorFeatures;
      ruleResult: RuleResult;
    } = body;

    const VALID_REGIONS = ["eye", "skin", "palm"];
    if (!imageBase64 || typeof imageBase64 !== "string" || imageBase64.length > 5_000_000) {
      return new Response(JSON.stringify({ error: "Invalid or missing imageBase64" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!region || !VALID_REGIONS.includes(region)) {
      return new Response(JSON.stringify({ error: `Invalid region. Must be one of: ${VALID_REGIONS.join(", ")}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!colorFeatures || typeof colorFeatures !== "object") {
      return new Response(JSON.stringify({ error: "Invalid colorFeatures" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!ruleResult || typeof ruleResult !== "object") {
      return new Response(JSON.stringify({ error: "Invalid ruleResult" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull last 5 reports for trend analysis
    const { data: history } = await supabase
      .from("reports")
      .select("condition, severity, confidence, created_at")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    const histArr = (history as HistoryItem[] | null) ?? [];

    let parsed: {
      condition: string;
      severity: "none" | "mild" | "moderate" | "severe";
      confidence: number;
      observations: string;
      trend: string;
      trend_note: string;
      recommendation: string;
    } | null = null;

    if (LOVABLE_API_KEY) {
      const historyText = histArr.length
        ? histArr
            .map(
              (h, i) =>
                `${i + 1}. ${h.created_at.slice(0, 10)} — ${h.condition} (${h.severity}, ${h.confidence}%)`
            )
            .join("\n")
        : "No previous reports.";

      const systemPrompt = `You are SkinScope AI, an educational wellness assistant that analyzes images of skin, eyes, or palms for visible color-based signs (yellowing suggesting possible jaundice, redness suggesting possible burns or inflammation). You are NOT a medical device and must never give a clinical diagnosis. Be cautious, emphasize "possible" / "appears", and always recommend consulting a healthcare professional for any concerning findings. Always return valid JSON via the provided tool.`;

      const userPrompt = `Analyze this ${region} image.

Client-side color analysis:
- Yellow pixel ratio: ${colorFeatures.yellowRatio}%
- Red pixel ratio: ${colorFeatures.redRatio}%
- Dark pixel ratio: ${colorFeatures.darkRatio}%
- Brightness: ${colorFeatures.brightness}/100
- Avg RGB: (${colorFeatures.avgR}, ${colorFeatures.avgG}, ${colorFeatures.avgB})

Rule-based pre-assessment:
- Condition: ${ruleResult.condition}
- Severity: ${ruleResult.severity}
- Rule confidence: ${ruleResult.ruleConfidence}%

User's recent report history (most recent first):
${historyText}

Provide a structured wellness assessment. Confirm or refine the rule-based finding using what you see in the image. Note image quality issues if any. Compare with history to identify trend (improving / stable / worsening / first_report). Never diagnose — use "appears", "possible", "consistent with".`;

      try {
        const aiResp = await fetch(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: systemPrompt },
                {
                  role: "user",
                  content: [
                    { type: "text", text: userPrompt },
                    {
                      type: "image_url",
                      image_url: { url: imageBase64 },
                    },
                  ],
                },
              ],
              tools: [
                {
                  type: "function",
                  function: {
                    name: "submit_assessment",
                    description: "Return the structured wellness assessment.",
                    parameters: {
                      type: "object",
                      properties: {
                        condition: { type: "string" },
                        severity: {
                          type: "string",
                          enum: ["none", "mild", "moderate", "severe"],
                        },
                        confidence: { type: "number" },
                        observations: { type: "string" },
                        trend: {
                          type: "string",
                          enum: ["improving", "stable", "worsening", "first_report", "inconclusive"],
                        },
                        trend_note: { type: "string" },
                        recommendation: { type: "string" },
                      },
                      required: [
                        "condition",
                        "severity",
                        "confidence",
                        "observations",
                        "trend",
                        "trend_note",
                        "recommendation",
                      ],
                      additionalProperties: false,
                    },
                  },
                },
              ],
              tool_choice: {
                type: "function",
                function: { name: "submit_assessment" },
              },
            }),
          }
        );

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall) {
            parsed = JSON.parse(toolCall.function.arguments);
          }
        }
      } catch (err) {
        console.error("AI gateway fallback triggered", err);
      }
    }

    if (!parsed) {
      parsed = buildFallbackAssessment(region, colorFeatures, ruleResult, histArr);
    }

    // Weighted final severity: 70% current AI + 30% historical mean
    const histScore = histArr.length
      ? histArr.reduce((sum, h) => sum + (SEVERITY_SCORE[h.severity] ?? 0), 0) / histArr.length
      : SEVERITY_SCORE[parsed.severity] ?? 0;
    const currentScore = SEVERITY_SCORE[parsed.severity] ?? 0;
    const blended = currentScore * 0.7 + histScore * 0.3;
    const finalSeverity = severityFromScore(blended);

    const result = {
      condition: parsed.condition,
      severity: finalSeverity,
      raw_severity: parsed.severity,
      confidence: Math.min(99, Math.max(20, Math.round(parsed.confidence))),
      observations: parsed.observations,
      trend: histArr.length ? parsed.trend : "first_report",
      trend_note: parsed.trend_note,
      recommendation: parsed.recommendation,
      historical_count: histArr.length,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-skin error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
