import type { BeatStats, City, CrimeTypeOption, HeatmapFilters, HeatmapResponse } from "../types";
import type { FeatureCollection, Geometry } from "geojson";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";
const cache = new Map<string, Promise<unknown>>();

type BeatFeatureCollection = FeatureCollection<Geometry, {
  beat_number?: string;
  district?: string;
}>;

export interface BeatOption {
  beatNumber: string;
  district: string;
}

async function requestJson<T>(path: string, friendlyMessage: string, useCache = true): Promise<T> {
  const url = `${API_BASE}${path}`;
  if (useCache && cache.has(url)) {
    return cache.get(url) as Promise<T>;
  }

  const promise = fetch(url).then(async (response) => {
    if (!response.ok) {
      console.error("[communityApi] Request failed", {
        url,
        status: response.status,
        body: await response.text(),
      });
      throw new Error(friendlyMessage);
    }
    return response.json() as Promise<T>;
  }).catch((error) => {
    console.error("[communityApi] Request failed", { url, error });
    throw new Error(friendlyMessage);
  });

  if (useCache) cache.set(url, promise);
  return promise;
}

function heatmapQuery(filters: HeatmapFilters): string {
  const params = new URLSearchParams({
    city_slug: filters.city_slug,
    year: String(filters.year),
    hour_min: String(filters.hour_min),
    hour_max: String(filters.hour_max),
  });
  if (filters.primary_type) params.set("primary_type", filters.primary_type);
  return params.toString();
}

export function getHealthDb() {
  return requestJson<{ status: string; database: string }>(
    "/health/db",
    "The API is not reachable right now.",
    false,
  );
}

export function getCities() {
  return requestJson<City[]>("/cities", "Cities are unavailable right now.");
}

export function getCrimeTypes(citySlug: string) {
  return requestJson<CrimeTypeOption[]>(
    `/heatmap/crime_types?city_slug=${citySlug}`,
    "Crime types are unavailable right now.",
  );
}

export function getBeatGeoJson(citySlug: string) {
  return requestJson<BeatFeatureCollection>(
    `/geo/beats?city_slug=${citySlug}`,
    "Beat boundaries are unavailable right now.",
  );
}

export async function getBeatOptions(citySlug: string): Promise<BeatOption[]> {
  const geoJson = await getBeatGeoJson(citySlug);
  return geoJson.features
    .map((feature) => ({
      beatNumber: feature.properties?.beat_number ?? "",
      district: feature.properties?.district ?? "",
    }))
    .filter((beat) => beat.beatNumber)
    .sort((a, b) => a.beatNumber.localeCompare(b.beatNumber));
}

export function getHeatmap(filters: HeatmapFilters) {
  return requestJson<HeatmapResponse>(
    `/heatmap?${heatmapQuery(filters)}`,
    "Incident counts are unavailable right now.",
  );
}

export function getBeatDetail(citySlug: string, beatNumber: string, year: number) {
  return requestJson<BeatStats>(
    `/beats/${beatNumber}?city_slug=${citySlug}&year=${year}`,
    "Beat details are unavailable right now.",
  );
}
