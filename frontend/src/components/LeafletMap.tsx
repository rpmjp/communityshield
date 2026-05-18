import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, GeoJSON, TileLayer, useMap, ZoomControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Feature, FeatureCollection } from "geojson";
import type { City, HeatmapFilters, HeatmapResponse } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

interface Props {
  filters: HeatmapFilters;
  cities: City[];
  selectedBeat: string | null;
  onSelectBeat: (beatNumber: string | null) => void;
}

// Heatmap color scale matching MapLibre version
function colorForCount(count: number, max: number): string {
  if (max <= 0) return "#1a3d33";
  const t = Math.min(count / max, 1);
  const stops = [
    { t: 0, color: [26, 61, 51] },
    { t: 0.25, color: [45, 95, 79] },
    { t: 0.5, color: [122, 78, 31] },
    { t: 0.75, color: [201, 122, 46] },
    { t: 1, color: [232, 160, 76] },
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].t && t <= stops[i + 1].t) {
      const span = stops[i + 1].t - stops[i].t;
      const localT = span > 0 ? (t - stops[i].t) / span : 0;
      const r = Math.round(stops[i].color[0] + localT * (stops[i + 1].color[0] - stops[i].color[0]));
      const g = Math.round(stops[i].color[1] + localT * (stops[i + 1].color[1] - stops[i].color[1]));
      const b = Math.round(stops[i].color[2] + localT * (stops[i + 1].color[2] - stops[i].color[2]));
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  return "#1a3d33";
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


function CityBoundsController({ cities, citySlug }: { cities: City[]; citySlug: string }) {
  const map = useMap();
  useEffect(() => {
    const city = cities.find((c) => c.slug === citySlug);
    if (!city) return;
    map.fitBounds(
      [
        [city.bounds.min_lat, city.bounds.min_lng],
        [city.bounds.max_lat, city.bounds.max_lng],
      ],
      { padding: [40, 40] }
    );
  }, [map, cities, citySlug]);
  return null;
}


export default function LeafletMap({ filters, cities, selectedBeat, onSelectBeat }: Props) {
  const [beats, setBeats] = useState<FeatureCollection | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [maxCount, setMaxCount] = useState<number>(1);
  const geoLayerRef = useRef<L.GeoJSON | null>(null);

  // Refs that always hold the latest values — used inside event handlers
  // to avoid stale closures.
  const countsRef = useRef(counts);
  const selectedBeatRef = useRef(selectedBeat);
  useEffect(() => { countsRef.current = counts; }, [counts]);
  useEffect(() => { selectedBeatRef.current = selectedBeat; }, [selectedBeat]);

  useEffect(() => {
    fetch(`${API_BASE}/geo/beats?city_slug=${filters.city_slug}`)
      .then((r) => r.json())
      .then((data) => setBeats(data))
      .catch((e) => console.error("[LeafletMap] beats fetch failed:", e));
  }, [filters.city_slug]);

  useEffect(() => {
    if (!beats) return;
    const query = buildHeatmapQuery(filters);
    fetch(`${API_BASE}/heatmap?${query}`)
      .then((r) => r.json())
      .then((data: HeatmapResponse) => {
        const c: Record<string, number> = {};
        data.beats.forEach((b) => { c[b.beat_number] = b.incident_count; });
        setCounts(c);
        setMaxCount(data.max_beat_incidents || 1);
      })
      .catch((e) => console.error("[LeafletMap] heatmap fetch failed:", e));
  }, [filters, beats]);

  useEffect(() => {
    if (!geoLayerRef.current) return;
    geoLayerRef.current.eachLayer((layer) => {
      const f = (layer as L.GeoJSON & { feature?: Feature }).feature;
      if (!f) return;
      const beatNum = (f.properties as { beat_number?: string } | null)?.beat_number ?? "";
      const count = counts[beatNum] ?? 0;
      const isSelected = beatNum === selectedBeat;
      (layer as L.Path).setStyle({
        fillColor: colorForCount(count, maxCount),
        fillOpacity: isSelected ? 0.75 : 0.5,
        color: isSelected ? "#F4D03F" : "#E8A04C",
        weight: isSelected ? 3 : 0.5,
        opacity: isSelected ? 1 : 0.6,
      });
    });
  }, [counts, maxCount, selectedBeat]);

  const defaultBounds: L.LatLngBoundsExpression = [
    [41.6445, -87.9401],
    [42.0230, -87.5241],
  ];

  const onEachBeat = (feature: Feature, layer: L.Layer) => {
    const beatNum = (feature.properties as { beat_number?: string; district?: string } | null)?.beat_number ?? "";
    const district = (feature.properties as { district?: string } | null)?.district ?? "";

    layer.on({
      mouseover: (e) => {
        const l = e.target as L.Path;
        l.setStyle({ fillOpacity: 0.75 });
        // Read count from ref at hover time so it's always current
        const count = countsRef.current[beatNum] ?? 0;
        l.bindTooltip(
          `<div class="cs-tooltip-inner">
             <div class="cs-tooltip-beat">Beat ${beatNum}</div>
             <div class="cs-tooltip-district">District ${district}</div>
             <div class="cs-tooltip-count">${count.toLocaleString()} incidents</div>
           </div>`,
          { className: "cs-leaflet-tooltip", sticky: true, direction: "top", offset: [0, -4] }
        ).openTooltip();
      },
      mouseout: (e) => {
        const l = e.target as L.Path;
        const isSelected = beatNum === selectedBeatRef.current;
        l.setStyle({ fillOpacity: isSelected ? 0.75 : 0.5 });
        l.closeTooltip();
        l.unbindTooltip();
      },
      click: () => {
        onSelectBeat(beatNum);
      },
    });
  };
  
  if (!beats) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-brand-900 text-brand-300 text-sm z-0">
        Loading map...
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-0">
      <MapContainer
        bounds={defaultBounds}
        style={{ width: "100%", height: "100%", background: "#0A1814", position: "absolute", inset: 0 }}
        scrollWheelZoom={true}
        attributionControl={true}
        preferCanvas={true}
        zoomControl={false}
      >
        <ZoomControl position="bottomright" />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd"
          maxZoom={19}
        />
        <CityBoundsController cities={cities} citySlug={filters.city_slug} />
        <GeoJSON
          data={beats}
          ref={geoLayerRef as React.RefObject<L.GeoJSON>}
          style={(feature) => {
            const beatNum = (feature?.properties as { beat_number?: string } | null)?.beat_number ?? "";
            const count = counts[beatNum] ?? 0;
            const isSelected = beatNum === selectedBeat;
            return {
              fillColor: colorForCount(count, maxCount),
              fillOpacity: isSelected ? 0.75 : 0.5,
              color: isSelected ? "#F4D03F" : "#E8A04C",
              weight: isSelected ? 3 : 0.5,
              opacity: isSelected ? 1 : 0.6,
            };
          }}
          onEachFeature={onEachBeat}
        />
      </MapContainer>
    </div>
  );
}
