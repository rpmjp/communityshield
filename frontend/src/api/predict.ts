import type { AllPredictionsResponse, PredictionFeatures } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

export async function predictAll(features: PredictionFeatures): Promise<AllPredictionsResponse> {
  const res = await fetch(`${API_BASE}/predict/all`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(features),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Prediction failed (${res.status}): ${text}`);
  }
  return res.json();
}