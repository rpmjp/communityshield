import { useEffect, useState } from "react";
import BeatDetailPanel from "./components/BeatDetailPanel";
import CrimeMap from "./components/CrimeMap";
import FilterBar from "./components/FilterBar";
import MapErrorBoundary from "./components/MapErrorBoundary";
import MapFallback from "./components/MapFallback";
import PredictionPanel, { type PredictionPanelInitial } from "./components/PredictionPanel";
import type { City, HeatmapFilters } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

type Health = { status: string; database: string };

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [selectedBeat, setSelectedBeat] = useState<string | null>(null);
  const [predictionInitial, setPredictionInitial] = useState<PredictionPanelInitial | null>(null);
  const [filters, setFilters] = useState<HeatmapFilters>({
    city_slug: "chicago",
    year: 2024,
    hour_min: 0,
    hour_max: 23,
    primary_type: null,
  });

  useEffect(() => {
    fetch(`${API_BASE}/health/db`)
      .then((r) => r.json())
      .then(setHealth)
      .catch((e) => setError(String(e)));

    fetch(`${API_BASE}/cities`)
      .then((r) => r.json())
      .then(setCities)
      .catch(() => setCities([]));
  }, []);

  return (
    <div className="fixed inset-0 flex bg-brand-900 text-brand-50">
      {/* Map area */}
      <div className="flex-1 relative">
        <MapErrorBoundary fallback={<MapFallback />}>
          <CrimeMap
            filters={filters}
            cities={cities}
            selectedBeat={selectedBeat}
            onSelectBeat={setSelectedBeat}
          />
        </MapErrorBoundary>

        {/* Top toolbar — header on left, filters on right */}
        <div className="absolute top-4 left-4 right-4 z-10 flex items-center gap-4">
          <div className="flex items-center gap-3 bg-brand-800/90 backdrop-blur-sm
                          border border-brand-700 rounded-lg px-4 py-2.5 shadow-xl flex-shrink-0">
            <ShieldHeart className="w-6 h-6 text-accent-400" />
            <div>
              <div className="font-bold text-lg leading-tight">CommunityShield</div>
              <div className="text-xs text-brand-300">Community-led safety</div>
            </div>
            <div className="ml-3 pl-3 border-l border-brand-700 text-xs">
              {error && <span className="text-red-300">offline</span>}
              {!error && health && (
                <span className="text-accent-400">
                  ● {health.status === "ok" ? "live" : health.status}
                </span>
              )}
              {!error && !health && <span className="text-brand-300">connecting...</span>}
            </div>
          </div>

          <div className="flex-1 flex justify-end">
            <FilterBar filters={filters} cities={cities} onChange={setFilters} />
          </div>
        </div>

        {/* Legend */}
        <div className="absolute bottom-8 left-4 z-10 bg-brand-800/90 backdrop-blur-sm
                        border border-brand-700 rounded-lg px-3 py-2 text-xs shadow-xl">
          <div className="text-brand-300 uppercase tracking-wider mb-1">Incidents</div>
          <div className="flex items-center gap-1">
            <span className="text-brand-400">low</span>
            <div className="w-32 h-2 rounded"
                 style={{ background: "linear-gradient(to right, #1a3d33, #2D5F4F, #7a4e1f, #c97a2e, #E8A04C)" }} />
            <span className="text-brand-400">high</span>
          </div>
        </div>
      </div>

      {/* Side panel */}
      <div className="w-[28rem] border-l border-brand-700 overflow-y-auto">
        <div className="p-4 space-y-4">
          {selectedBeat && (
            <BeatDetailPanel
              citySlug={filters.city_slug}
              beatNumber={selectedBeat}
              year={filters.year}
              onClose={() => setSelectedBeat(null)}
              onUsedForPrediction={setPredictionInitial}
            />
          )}
          <PredictionPanel
            key={predictionInitial
              ? `${predictionInitial.beat_num}-${predictionInitial.district}`
              : "default"}
            initial={predictionInitial}
          />
        </div>
      </div>
    </div>
  );
}

function ShieldHeart({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path
        d="M24 4 L42 10 V24 C42 34 33 42 24 44 C15 42 6 34 6 24 V10 Z"
        fill="currentColor"
        opacity="0.18"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M24 33 C24 33 14 27 14 20 C14 16.5 16.5 14 20 14 C22 14 23.5 15 24 16.5 C24.5 15 26 14 28 14 C31.5 14 34 16.5 34 20 C34 27 24 33 24 33 Z"
        fill="currentColor"
      />
    </svg>
  );
}