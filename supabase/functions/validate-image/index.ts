// Validates whether an image actually contains the requested body region
// (skin / face / eye / palm) before running heavier analysis.
// @ts-ignore
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

// SECURITY FIX (FINDING-004): Restrict CORS to known production origins only.
// Wildcard "*" is replaced with an allowlist. OPTIONS preflight still responds
// to allow the browser to proceed; the actual origin check is done per-request.
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
    // SECURITY FIX (FINDING-003): Verify the JWT token with Supabase to ensure
    // only authenticated users can call this function. Previously, the auth
    // header was checked for presence only but never validated against Supabase.
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

    // SECURITY FIX (FINDING-010): Validate input field types/lengths.
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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return j({ error: "AI not configured" }, 500, corsHeaders);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
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

    if (!aiResp.ok) {
      if (aiResp.status === 429) return j({ error: "Rate limit exceeded" }, 429, corsHeaders);
      if (aiResp.status === 402) return j({ error: "AI credits exhausted" }, 402, corsHeaders);
      return j({ error: "Validation service error" }, 500, corsHeaders);
    }
    const aiData = await aiResp.json();
    const tc = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) return j({ valid: true, detected: "unknown", reason: "", quality: "fair" }, 200, corsHeaders);
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
