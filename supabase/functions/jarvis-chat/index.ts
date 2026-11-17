// JARVIS health assistant — streaming chat with personal health context.
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

function streamSseText(text: string, corsHeaders: Record<string, string>): Response {
  const encoder = new TextEncoder();
  const words = text.split(/(?<=\s)/);
  const stream = new ReadableStream({
    async start(controller) {
      for (let i = 0; i < words.length; i += 4) {
        const chunk = words.slice(i, i + 4).join("");
        const payload = JSON.stringify({ choices: [{ delta: { content: chunk } }] });
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
  });
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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 50) {
      return new Response(
        JSON.stringify({ error: "Invalid messages: must be a non-empty array with at most 50 items." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const sanitizedMessages = messages.map((m: any) => ({
      role: ["user", "assistant", "system"].includes(m?.role) ? m.role : "user",
      content: typeof m?.content === "string" ? m.content.slice(0, 8000) : "",
    }));
    const userId = u.user.id;

    const [r, m, d, p, l] = await Promise.all([
      supabase.from("reports").select("region,condition,severity,confidence,trend,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
      supabase.from("medical_reports").select("report_type,extracted_values,abnormalities,summary,report_date").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
      supabase.from("symptom_diary").select("entry_date,itch,pain,redness,dryness,irritation,swelling,triggers").eq("user_id", userId).order("entry_date", { ascending: false }).limit(7),
      supabase.from("prescriptions").select("doctor_name,prescribed_date,medicines,ai_explanation").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
      supabase.from("lifestyle_logs").select("log_date,sleep_hours,water_glasses,stress_level,exercise_minutes,diet_quality").eq("user_id", userId).order("log_date", { ascending: false }).limit(7),
    ]);

    const scans = r.data ?? [];
    const meds = m.data ?? [];
    const diary = d.data ?? [];
    const rx = p.data ?? [];
    const life = l.data ?? [];

    if (API_KEY) {
      const context = `
USER HEALTH CONTEXT (most recent first):
Recent visual scans: ${JSON.stringify(scans)}
Recent lab/medical reports: ${JSON.stringify(meds)}
Symptom diary (last 7): ${JSON.stringify(diary)}
Prescriptions: ${JSON.stringify(rx)}
Lifestyle logs (last 7): ${JSON.stringify(life)}
`;
      const systemPrompt = `You are JARVIS, the SkinScope AI personal health assistant. You answer health questions in a calm, friendly, conversational tone. Use the user's personal health context (provided below) to ground your answers when relevant. Reference their actual scans, lab values, symptoms, prescriptions, and lifestyle logs when applicable.

CRITICAL RULES:
- Never give a medical diagnosis. Use phrases like "appears", "may suggest", "could be associated with".
- Always recommend consulting a licensed healthcare professional for concerning findings.
- Explain medical terms in plain language.
- Be concise unless the user asks for detail. Use markdown formatting (lists, **bold**) where helpful.
- If asked about medicine, explain general purpose, common dosage timing, and common side effects, but never prescribe.

${context}`;

      for (const model of MODELS) {
        try {
          const aiResp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
            signal: AbortSignal.timeout(10000),
            body: JSON.stringify({
              model,
              reasoning_effort: "low",
              stream: true,
              messages: [{ role: "system", content: systemPrompt }, ...sanitizedMessages],
            }),
          });
          if (aiResp.ok && aiResp.body) {
            return new Response(aiResp.body, {
              headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
            });
          }
        } catch (err) {
          console.error(`jarvis-chat model ${model} failed:`, err);
        }
      }
    }

    const lastQuestion = sanitizedMessages[sanitizedMessages.length - 1]?.content || "";
    const latestScan = scans[0];
    const latestMed = meds[0];
    const latestDiary = diary[0];
    const latestRx = rx[0];

    let reply = `### J.A.R.V.I.S. Health Intelligence Summary\n\n`;
    if (scans.length > 0) {
      reply += `- **Recent Visual Scans (${scans.length}):** Your most recent scan on **${latestScan.created_at.slice(0, 10)}** (${latestScan.region}) indicated **${latestScan.condition}** with **${latestScan.severity}** severity (${latestScan.confidence}% confidence).\n`;
    } else {
      reply += `- **Visual Scans:** No skin, eye, or palm scans recorded yet. Try running a new scan in the **Analyze** tab.\n`;
    }

    if (meds.length > 0) {
      reply += `- **Lab Reports (${meds.length}):** Latest report (${latestMed.report_type || "general"}) summary: ${latestMed.summary || "Recorded for tracking"}.\n`;
    }
    if (diary.length > 0) {
      reply += `- **Symptom Diary (${diary.length} entries):** Latest entry on ${latestDiary.entry_date} logged redness (${latestDiary.redness}/10), itch (${latestDiary.itch}/10), and dryness (${latestDiary.dryness}/10).\n`;
    }
    if (rx.length > 0) {
      reply += `- **Prescriptions (${rx.length}):** Latest prescription from ${latestRx.doctor_name || "clinician"} (${latestRx.prescribed_date || "recent"}).\n`;
    }

    reply += `\n#### Wellness Guidance for Your Query\nRegarding *"${lastQuestion.slice(0, 120)}"*:\n`;
    reply += `1. **Consistent Monitoring:** Capture follow-up scans under consistent daylight to track color feature changes accurately.\n`;
    reply += `2. **Hydration & Barrier Care:** Maintain 8+ glasses of water daily, use gentle fragrance-free moisturizers, and apply broad-spectrum SPF 30+.\n`;
    reply += `3. **Clinical Consultation:** *SkinScope AI is an educational wellness tool and not a medical device.* Please consult a board-certified dermatologist or physician for any persistent or concerning symptoms.`;

    return streamSseText(reply, corsHeaders);
  } catch (e) {
    console.error("jarvis-chat error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
