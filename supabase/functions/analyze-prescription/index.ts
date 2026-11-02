// Prescription / medicine OCR + interpretation via Gemini multimodal.
// @ts-ignore
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-ignore
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
    if (!LOVABLE_API_KEY) return j({ error: "AI not configured" }, 500, corsHeaders);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return j({ error: "Unauthorized" }, 401, corsHeaders);
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return j({ error: "Unauthorized" }, 401, corsHeaders);

    // SECURITY FIX (FINDING-010): Validate imageBase64 input.
    const body = await req.json();
    const { imageBase64 } = body;
    if (!imageBase64 || typeof imageBase64 !== "string" || imageBase64.length > 10_000_000) {
      return j({ error: "Invalid or missing imageBase64" }, 400, corsHeaders);
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are a careful medical OCR assistant. Extract handwritten or printed prescription content from the image. Identify medicines as accurately as possible. Never invent. Mark uncertain readings with '(?)'. Always remind that interpretations are AI-assisted and not a substitute for the prescribing doctor.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Read this prescription / medicine image. Extract: raw text, list of medicines with name, dosage, frequency, duration if available, and a friendly explanation of what each medicine is generally used for, plus common precautions.",
              },
              { type: "image_url", image_url: { url: imageBase64 } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_prescription",
              parameters: {
                type: "object",
                properties: {
                  raw_text: { type: "string" },
                  doctor_name: { type: "string" },
                  prescribed_date: { type: "string", description: "YYYY-MM-DD if visible" },
                  medicines: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        dosage: { type: "string" },
                        frequency: { type: "string" },
                        duration: { type: "string" },
                        purpose: { type: "string" },
                        precautions: { type: "string" },
                        side_effects: { type: "string" },
                      },
                      required: ["name"],
                    },
                  },
                  ai_explanation: { type: "string" },
                },
                required: ["raw_text", "medicines", "ai_explanation"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_prescription" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return j({ error: "Rate limit exceeded" }, 429, corsHeaders);
      if (aiResp.status === 402) return j({ error: "AI credits exhausted" }, 402, corsHeaders);
      return j({ error: "AI service error" }, 500, corsHeaders);
    }
    const aiData = await aiResp.json();
    const tc = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) return j({ error: "Malformed AI response" }, 500, corsHeaders);
    return j(JSON.parse(tc.function.arguments), 200, corsHeaders);
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
