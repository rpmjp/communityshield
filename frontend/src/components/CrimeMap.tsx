import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { City, HeatmapFilters, HeatmapResponse } from "../types";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

interface Props {
  filters: HeatmapFilters;
  cities: City[];
  selectedBeat: string | null;
  onSelectBeat: (beatNumber: string | null) => void;
}

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    return !!gl;
  } catch {
    return false;
  }
}

function buildHeatmapQuery(filters: HeatmapFilters): string {
  const params = new URLSearchParams({
    city_slug: filters.city_slug,
    year: String(filters.year),
    hour_min: String(filters.hour_min),
    hour_max: String(filters.hour_max),
  });
  if (filters.primary_type) {
    params.set("primary_type", filters.primary_type);
  }
  return params.toString();
}

export default function CrimeMap({ filters, cities, selectedBeat, onSelectBeat }: Props) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const beatsLoadedFor = useRef<string | null>(null);
  const beatNumbersRef = useRef<string[]>([]);
  const selectedBeatRef = useRef<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [beatsReadyCity, setBeatsReadyCity] = useState<string | null>(null);
  const [heatmapStatus, setHeatmapStatus] = useState<{
    state: "idle" | "loading" | "empty" | "error" | "ready";
    message?: string;
  }>({ state: "idle" });

  // Keep ref in sync (used inside map event handlers without re-binding)
  useEffect(() => {
    selectedBeatRef.current = selectedBeat;
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (map.getLayer("beats-fill")) {
      map.setPaintProperty("beats-fill", "fill-opacity", buildOpacityExpr(selectedBeat));
    }
    if (map.getLayer("beats-selected-outline")) {
      map.setFilter("beats-selected-outline", [
        "==", ["get", "beat_number"], selectedBeat ?? "__none__",
      ]);
    }
  }, [selectedBeat]);
  // Initialize map once
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    if (!detectWebGL()) {
      throw new Error("WebGL is not available in this browser");
    }

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: [-87.6298, 41.8781],
      zoom: 10,
      minZoom: 8,
      maxZoom: 16,
      attributionControl: { compact: true },
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "imperial" }), "bottom-left");

    mapRef.current = map;
    map.once("load", () => setMapReady(true));

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Load beat polygons whenever city changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const loadBeats = async () => {
      if (beatsLoadedFor.current === filters.city_slug) {
        setBeatsReadyCity(filters.city_slug);
        return;
      }

      try {
        const res = await fetch(
          `${API_BASE}/geo/beats?city_slug=${filters.city_slug}`
        );
        if (!res.ok) throw new Error(`Beats fetch failed: ${res.status}`);
        const beatsGeoJson = await res.json();
        beatNumbersRef.current = beatsGeoJson.features
          .map((feature: { properties?: { beat_number?: string } }) => feature.properties?.beat_number)
          .filter((beatNumber: string | undefined): beatNumber is string => Boolean(beatNumber));

        // Remove old layers/source if any (order matters: layers before source)
        if (map.getLayer("beats-selected-outline")) map.removeLayer("beats-selected-outline");
        if (map.getLayer("beats-outline")) map.removeLayer("beats-outline");
        if (map.getLayer("beats-fill")) map.removeLayer("beats-fill");
        if (map.getSource("beats")) map.removeSource("beats");

        map.addSource("beats", {
          type: "geojson",
          data: beatsGeoJson,
          promoteId: "beat_number",
        });

        map.addLayer({
          id: "beats-fill",
          type: "fill",
          source: "beats",
          paint: {
            "fill-color": "#2D5F4F",
            "fill-opacity": buildOpacityExpr(selectedBeatRef.current),
          },
        });

        map.addLayer({
          id: "beats-outline",
          type: "line",
          source: "beats",
          paint: {
            "line-color": "#E8A04C",
            "line-width": 0.5,
            "line-opacity": 0.6,
          },
        });

        // Separate layer for the selected beat outline (sits on top, thicker)
        map.addLayer({
          id: "beats-selected-outline",
          type: "line",
          source: "beats",
          paint: {
            "line-color": "#F4D03F",
            "line-width": 3,
            "line-opacity": 1,
          },
          filter: ["==", ["get", "beat_number"], selectedBeatRef.current ?? "__none__"],
        });

        // Click handler
        map.on("click", "beats-fill", (e) => {
          const feature = e.features?.[0];
          if (!feature) return;
          const beatNum = feature.properties?.beat_number;
          if (beatNum) onSelectBeat(beatNum);
        });

        // Hover state + tooltip
        const popup = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          className: "cs-tooltip",
          offset: 8,
        });

        let hoveredId: string | number | null = null;
        map.on("mousemove", "beats-fill", (e) => {
          if (!e.features || e.features.length === 0) return;
          if (hoveredId !== null) {
            map.setFeatureState({ source: "beats", id: hoveredId }, { hover: false });
          }
          hoveredId = e.features[0].id ?? null;
          if (hoveredId !== null) {
            map.setFeatureState({ source: "beats", id: hoveredId }, { hover: true });
          }
          map.getCanvas().style.cursor = "pointer";

          const f = e.features[0];
          const beatNum = f.properties?.beat_number ?? "";
          const district = f.properties?.district ?? "";
          const state = map.getFeatureState({ source: "beats", id: beatNum });
          const count = state?.count ?? 0;

          popup
            .setLngLat(e.lngLat)
            .setHTML(
              `<div class="cs-tooltip-inner">
                 <div class="cs-tooltip-beat">Beat ${beatNum}</div>
                 <div class="cs-tooltip-district">District ${district}</div>
                 <div class="cs-tooltip-count">${Number(count).toLocaleString()} incidents</div>
               </div>`
            )
            .addTo(map);
        });
        map.on("mouseleave", "beats-fill", () => {
          if (hoveredId !== null) {
            map.setFeatureState({ source: "beats", id: hoveredId }, { hover: false });
          }
          hoveredId = null;
          map.getCanvas().style.cursor = "";
          popup.remove();
        });

        beatsLoadedFor.current = filters.city_slug;
        setBeatsReadyCity(filters.city_slug);
        console.log(`[CrimeMap] Loaded ${beatsGeoJson.features.length} beats for ${filters.city_slug}`);

        // Fly to city bounds
        const city = cities.find((c) => c.slug === filters.city_slug);
        if (city) {
          map.fitBounds(
            [
              [city.bounds.min_lng, city.bounds.min_lat],
              [city.bounds.max_lng, city.bounds.max_lat],
            ],
            { padding: 40, duration: 800 }
          );
        }
      } catch (err) {
        console.error("[CrimeMap] Failed to load beats:", err);
        setHeatmapStatus({
          state: "error",
          message: "Beat boundaries could not be loaded for the selected city.",
        });
      }
    };

    loadBeats();
  }, [filters.city_slug, cities, onSelectBeat, mapReady]);

  // Load heatmap data whenever filters change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (beatsReadyCity !== filters.city_slug || beatsLoadedFor.current !== filters.city_slug) {
      return;
    }

    const loadHeatmap = async () => {
      setHeatmapStatus({ state: "loading", message: "Loading incident counts..." });
      try {
        const query = buildHeatmapQuery(filters);
        const res = await fetch(`${API_BASE}/heatmap?${query}`);
        if (!res.ok) throw new Error(`Heatmap fetch failed: ${res.status}`);
        const data: HeatmapResponse = await res.json();

        // Build a map of beat_number -> incident count
        const counts: Record<string, number> = {};
        data.beats.forEach((b) => {
          counts[b.beat_number] = b.incident_count;
        });
        const maxCount = data.max_beat_incidents || 1;
        setHeatmapStatus(data.beats.length === 0
          ? {
              state: "empty",
              message: "No incidents match the selected filters. Try another year, time, or type.",
            }
          : {
              state: "ready",
              message: `${data.total_incidents.toLocaleString()} incidents match the selected filters.`,
            });

        // Update each feature's state with its count
        const source = map.getSource("beats");
        if (!source) return;

        // Style fill-color by count via a data-driven expression
        if (map.getLayer("beats-fill")) {
          map.setPaintProperty("beats-fill", "fill-color", [
            "interpolate",
            ["linear"],
            ["coalesce", ["feature-state", "count"], 0],
            0, "#1a3d33",
            maxCount * 0.25, "#2D5F4F",
            maxCount * 0.5, "#7a4e1f",
            maxCount * 0.75, "#c97a2e",
            maxCount, "#E8A04C",
          ]);
        }

        beatNumbersRef.current.forEach((beatNum) => {
          const count = counts[beatNum] ?? 0;
          map.setFeatureState(
            { source: "beats", id: beatNum },
            { count }
          );
        });

        console.log(`[CrimeMap] Heatmap updated: ${data.beats.length} beats, max ${maxCount}`);
      } catch (err) {
        console.error("[CrimeMap] Failed to load heatmap:", err);
        setHeatmapStatus({
          state: "error",
          message: "Incident counts could not be loaded. The map boundaries may still be selectable.",
        });
      }
    };

    loadHeatmap();
  }, [filters, beatsReadyCity, mapReady]);

  const visibleStatus = !mapReady || beatsReadyCity !== filters.city_slug
    ? { state: "loading" as const, message: "Loading beat boundaries..." }
    : heatmapStatus;

  return (
    <>
      <div
        ref={mapContainer}
        style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
      />
      {visibleStatus.state !== "ready" && visibleStatus.state !== "idle" && (
        <div
          className="absolute left-4 bottom-24 z-10 max-w-xs rounded-lg border border-brand-700 bg-brand-800/95 px-3 py-2 text-xs text-brand-200 shadow-xl backdrop-blur-sm"
          role={visibleStatus.state === "error" ? "alert" : "status"}
        >
          <div className="font-medium text-brand-50">
            {visibleStatus.state === "loading" && "Loading map data"}
            {visibleStatus.state === "empty" && "No matching data"}
            {visibleStatus.state === "error" && "Map data issue"}
          </div>
          {visibleStatus.message && (
            <div className="mt-1 text-brand-300">{visibleStatus.message}</div>
          )}
        </div>
      )}
    </>
  );
}

// Helper: opacity expression that highlights the selected beat
function buildOpacityExpr(selectedBeat: string | null): maplibregl.ExpressionSpecification {
  return [
    "case",
    ["==", ["get", "beat_number"], selectedBeat ?? ""], 0.75,
    ["boolean", ["feature-state", "hover"], false], 0.65,
    0.45,
  ];
}
