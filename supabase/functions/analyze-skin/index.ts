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
  "http://localhost:5173",
  "http://localhost:4173",
  "capacitor://localhost",
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // SECURITY FIX (FINDING-010): Strict input validation.
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

    const historyText = (history as HistoryItem[] | null)?.length
      ? (history as HistoryItem[])
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
                    condition: {
                      type: "string",
                      description: "Brief plain-language description of what is observed (e.g., 'Possible mild jaundice', 'Healthy appearance').",
                    },
                    severity: {
                      type: "string",
                      enum: ["none", "mild", "moderate", "severe"],
                    },
                    confidence: {
                      type: "number",
                      description: "0-100 confidence score for this assessment.",
                    },
                    observations: {
                      type: "string",
                      description: "2-4 sentences describing visible features and image quality.",
                    },
                    trend: {
                      type: "string",
                      enum: ["improving", "stable", "worsening", "first_report", "inconclusive"],
                    },
                    trend_note: {
                      type: "string",
                      description: "1-2 sentences explaining the trend conclusion.",
                    },
                    recommendation: {
                      type: "string",
                      description: "Practical wellness recommendation. Always include consulting a healthcare professional if any concerning sign is present.",
                    },
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

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error("No tool call returned", JSON.stringify(aiData));
      return new Response(JSON.stringify({ error: "AI returned malformed response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);

    // Weighted final severity: 70% current AI + 30% historical mean
    const histArr = (history as HistoryItem[] | null) ?? [];
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
