import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const CHICAGO_CENTER: [number, number] = [-87.6298, 41.8781];
const INITIAL_ZOOM = 10;
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";


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


export default function CrimeMap() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    // Detect WebGL up front; let the error boundary handle the fallback
    if (!detectWebGL()) {
      throw new Error("WebGL is not available in this browser");
    }

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: CHICAGO_CENTER,
      zoom: INITIAL_ZOOM,
      minZoom: 8,
      maxZoom: 16,
      attributionControl: { compact: true },
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "imperial" }), "bottom-right");

    // Catch async webgl context loss
    map.on("error", (e) => {
      console.error("[CrimeMap] Map error:", e.error);
    });

    mapRef.current = map;

    map.on("load", async () => {
      try {
        const res = await fetch(`${API_BASE}/geo/beats`);
        if (!res.ok) throw new Error(`Beats fetch failed: ${res.status}`);
        const beatsGeoJson = await res.json();

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
            "fill-opacity": [
              "case",
              ["boolean", ["feature-state", "hover"], false], 0.55,
              0.25,
            ],
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
        });

        map.on("mouseleave", "beats-fill", () => {
          if (hoveredId !== null) {
            map.setFeatureState({ source: "beats", id: hoveredId }, { hover: false });
          }
          hoveredId = null;
          map.getCanvas().style.cursor = "";
        });

        console.log(`[CrimeMap] Loaded ${beatsGeoJson.features.length} beats`);
      } catch (err) {
        console.error("[CrimeMap] Failed to load beats:", err);
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div
      ref={mapContainer}
      style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
    />
  );
}