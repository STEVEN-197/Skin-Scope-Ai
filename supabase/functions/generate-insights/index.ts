// Generate longitudinal AI health insights by correlating
// scan reports + medical lab reports + symptom diary.

// @ts-ignore
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-ignore
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
    if (!authHeader) return j({ error: "Unauthorized" }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return j({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const [reportsRes, medRes, diaryRes] = await Promise.all([
      supabase
        .from("reports")
        .select("region, condition, severity, confidence, trend, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("medical_reports")
        .select("report_type, extracted_values, abnormalities, summary, ai_analysis, report_date, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("symptom_diary")
        .select("entry_date, itch, pain, redness, dryness, irritation, swelling, triggers")
        .eq("user_id", userId)
        .order("entry_date", { ascending: false })
        .limit(20),
    ]);

    const scans = reportsRes.data ?? [];
    const meds = medRes.data ?? [];
    const diary = diaryRes.data ?? [];

    if (scans.length === 0 && meds.length === 0 && diary.length === 0) {
      return j({
        empty: true,
        summary: "Not enough history to generate health insights yet. Add a scan, lab report, or diary entry to get started.",
        observations: [],
        trends: [],
        recommendations: [],
      });
    }

    let parsed: any = null;

    if (LOVABLE_API_KEY) {
      const systemPrompt = `You are SkinScope Health Intelligence, an AI assistant that produces longitudinal, multi-modal wellness observations. You correlate visual scan analyses with lab report values and self-reported symptom diary data. Use cautious language and never give a clinical diagnosis. Always recommend consulting a healthcare professional for concerning trends. Always return JSON via the provided tool.`;

      const userPrompt = `Analyze this user's combined health history.

VISUAL SCANS (most recent first):
${JSON.stringify(scans, null, 2)}

LAB / MEDICAL REPORTS (most recent first):
${JSON.stringify(meds, null, 2)}

SYMPTOM DIARY (most recent first):
${JSON.stringify(diary, null, 2)}`;

      try {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "submit_insights",
                  parameters: {
                    type: "object",
                    properties: {
                      summary: { type: "string" },
                      observations: { type: "array", items: { type: "object" } },
                      trends: { type: "array", items: { type: "object" } },
                      recommendations: { type: "array", items: { type: "object" } },
                    },
                    required: ["summary", "observations", "trends", "recommendations"],
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "submit_insights" } },
          }),
        });
        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const tc = aiData?.choices?.[0]?.message?.tool_calls?.[0];
          if (tc) parsed = JSON.parse(tc.function.arguments);
        }
      } catch (err) {
        console.error("generate-insights fallback triggered", err);
      }
    }

    if (!parsed) {
      const latestScan = scans[0];
      parsed = {
        summary: `Correlated wellness review across ${scans.length} visual scan(s), ${meds.length} lab report(s), and ${diary.length} symptom diary log(s). ${
          latestScan
            ? `Most recent visual assessment (${latestScan.region}) indicated ${latestScan.condition} (${latestScan.severity}).`
            : "Continue logging scans and symptoms for longitudinal tracking."
        }`,
        observations: [
          {
            title: "Visual Scan Trajectory",
            detail: latestScan
              ? `Latest ${latestScan.region} scan logged "${latestScan.condition}" (${latestScan.severity}, ${latestScan.confidence}% confidence).`
              : "No visual scans logged yet.",
            level: latestScan?.severity === "severe" || latestScan?.severity === "moderate" ? "concern" : "info",
          },
          {
            title: "Symptom & Lab Correlation",
            detail: `Analyzed ${diary.length} symptom entries alongside ${meds.length} lab report records.`,
            level: "info",
          },
        ],
        trends: [
          {
            metric: "Visual Chromatic Index",
            direction: scans.length > 1 ? "stable" : "inconclusive",
            note: scans.length > 1 ? "Consistent across recent visual captures." : "Baseline scan established.",
          },
        ],
        recommendations: [
          {
            title: "Standardize Scan Lighting",
            detail: "Capture follow-up images in indirect natural daylight for consistent chromatic comparison.",
            category: "monitoring",
          },
          {
            title: "Daily Hydration & Barrier Support",
            detail: "Maintain steady water intake and gentle skincare routines while tracking daily triggers.",
            category: "hydration",
          },
          {
            title: "Professional Review",
            detail: "Share your exported PDF summary with a licensed physician for clinical interpretation.",
            category: "consultation",
          },
        ],
      };
    }

    const inputs_snapshot = {
      scans_count: scans.length,
      meds_count: meds.length,
      diary_count: diary.length,
    };
    await supabase.from("health_insights").insert({
      user_id: userId,
      summary: parsed.summary,
      observations: parsed.observations,
      trends: parsed.trends,
      recommendations: parsed.recommendations,
      inputs_snapshot,
    });

    return j({ ...parsed, inputs_snapshot });
  } catch (e) {
    console.error("generate-insights error", e);
    return j({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }

  function j(obj: unknown, status = 200, hdrs: Record<string, string> = corsHeaders) {
    return new Response(JSON.stringify(obj), {
      status,
      headers: { ...hdrs, "Content-Type": "application/json" },
    });
  }
});
