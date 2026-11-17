// Validates whether an image actually contains the requested body region
// (skin / face / eye / palm) before running heavier analysis.
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

const MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.8-flash"];

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
    const { imageBase64, region } = body;
    const VALID_REGIONS = ["skin", "face", "eye", "palm"];
    if (!imageBase64 || typeof imageBase64 !== "string" || imageBase64.length > 5_000_000) {
      return j({ error: "Invalid or missing imageBase64" }, 400, corsHeaders);
    }
    if (!region || !VALID_REGIONS.includes(region)) {
      return j({ error: `Invalid region. Must be one of: ${VALID_REGIONS.join(", ")}` }, 400, corsHeaders);
    }

    // @ts-ignore
    const API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("LOVABLE_API_KEY");
    if (!API_KEY) {
      return j({ valid: true, detected: region, reason: "", quality: "good" }, 200, corsHeaders);
    }

    for (const model of MODELS) {
      try {
        const aiResp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
          signal: AbortSignal.timeout(10000),
          body: JSON.stringify({
            model,
            reasoning_effort: "low",
            messages: [
              {
                role: "system",
                content:
                  "You are an image content validator. Decide whether an image clearly shows the requested human body region (skin / eye / palm / face) suitable for visual wellness analysis. Reject paper, walls, random objects, blurred or extreme close-ups, screenshots, and irrelevant content.",
              },
              {
                role: "user",
                content: [
                  { type: "text", text: `Does this image clearly show a real human ${region}? Be strict.` },
                  { type: "image_url", image_url: { url: imageBase64 } },
                ],
              },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "submit_validation",
                  parameters: {
                    type: "object",
                    properties: {
                      valid: { type: "boolean" },
                      detected: { type: "string", description: "What appears in the image" },
                      reason: { type: "string", description: "If invalid, why" },
                      quality: { type: "string", enum: ["good", "fair", "poor"] },
                    },
                    required: ["valid", "detected", "reason", "quality"],
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "submit_validation" } },
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const tc = aiData?.choices?.[0]?.message?.tool_calls?.[0];
          if (tc) {
            return j(JSON.parse(tc.function.arguments), 200, corsHeaders);
          }
        }
      } catch (err) {
        console.error(`validate-image model ${model} failed:`, err);
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
