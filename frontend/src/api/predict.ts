import type { AllPredictionsResponse, PredictionFeatures } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

export async function predictAll(
  features: PredictionFeatures,
  explain = true,
): Promise<AllPredictionsResponse> {
  const res = await fetch(`${API_BASE}/predict/all?explain=${explain}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(features),
  });
  if (!res.ok) {
    console.error("[predictAll] Prediction request failed", {
      status: res.status,
      body: await res.text(),
    });
    throw new Error("Prediction service is unavailable. Check the inputs or try again in a moment.");
  }
  return res.json();
}
