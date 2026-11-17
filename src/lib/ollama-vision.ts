// Hybrid Ollama Vision AI + Dermatological ML Ensemble helper.
// Automatically detects if local Ollama (http://localhost:11434) is running with a vision
// model (e.g., moondream, llava, llama3.2-vision, minicpm-v) and fuses its visual assessment
// with the client/server ML color & tissue classifier. Zero API keys required.

import type { ColorFeatures, RuleResult } from "./color-analysis";

export interface OllamaVisionResult {
  valid_region: boolean;
  detected_object: string;
  condition: string;
  severity: "none" | "mild" | "moderate" | "severe";
  confidence: number;
  observations: string;
  recommendation: string;
  model_used: string;
}

const VISION_MODEL_PREFERENCES = [
  "moondream",
  "llava",
  "llama3.2-vision",
  "minicpm-v",
  "bakllava",
  "llava-phi3",
];

function getOllamaBaseUrl(): string {
  return (
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_OLLAMA_URL) ||
    "http://localhost:11434"
  );
}

export async function findLocalOllamaVisionModel(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const baseUrl = getOllamaBaseUrl();
  try {
    const resp = await fetch(`${baseUrl}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(1500),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const models: Array<{ name: string }> = data?.models ?? [];
    if (models.length === 0) return null;

    for (const pref of VISION_MODEL_PREFERENCES) {
      const found = models.find((m) => m.name.toLowerCase().includes(pref));
      if (found) return found.name;
    }
    return null;
  } catch {
    return null;
  }
}

export async function analyzeWithOllamaVision(
  imageBase64: string,
  region: "eye" | "skin" | "palm",
  colorFeatures: ColorFeatures,
  ruleResult: RuleResult
): Promise<OllamaVisionResult | null> {
  const model = await findLocalOllamaVisionModel();
  if (!model) return null;

  const baseUrl = getOllamaBaseUrl();
  const rawBase64 = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;

  const prompt = `You are a dermatological & clinical vision assistant.
Examine this image carefully. The user selected body region: "${region}".
ML pixel metrics: yellowRatio=${colorFeatures.yellowRatio}%, redRatio=${colorFeatures.redRatio}%, darkRatio=${colorFeatures.darkRatio}%, ML pre-assessment="${ruleResult.condition}" (${ruleResult.severity}).

Reply ONLY with valid JSON matching this exact structure:
{
  "valid_region": true or false (false if the image is a random object like a bucket, cup, wall, car, animal, or does not show a human ${region}),
  "detected_object": "what is visible in the image",
  "condition": "Healthy appearance" or specific finding (e.g. "Possible scleral icterus / jaundice", "Possible skin rash / inflammation", "Possible burn"),
  "severity": "none" | "mild" | "moderate" | "severe",
  "confidence": 75 to 95,
  "observations": "2 sentences describing visible yellow/red/lesion signs in the ${region} and combining with ML metrics",
  "recommendation": "1-2 sentences of wellness advice"
}`;

  try {
    const resp = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(18000),
      body: JSON.stringify({
        model,
        stream: false,
        format: "json",
        messages: [
          {
            role: "user",
            content: prompt,
            images: [rawBase64],
          },
        ],
      }),
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    const content = data?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content);
    const validSeverities = ["none", "mild", "moderate", "severe"];
    const sev = validSeverities.includes(parsed.severity) ? parsed.severity : ruleResult.severity;

    return {
      valid_region: parsed.valid_region !== false,
      detected_object: String(parsed.detected_object || region),
      condition: String(parsed.condition || ruleResult.condition),
      severity: sev,
      confidence: Number(parsed.confidence) || ruleResult.ruleConfidence || 85,
      observations: String(parsed.observations || ""),
      recommendation: String(parsed.recommendation || ""),
      model_used: model,
    };
  } catch {
    return null;
  }
}
