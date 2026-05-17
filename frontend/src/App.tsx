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
  const [manualPanelOpen, setManualPanelOpen] = useState(false);
  // Panel is open if user explicitly opened it OR a beat is selected
  const panelOpen = manualPanelOpen || selectedBeat !== null;
  const setPanelOpen = (open: boolean) => {
    setManualPanelOpen(open);
    if (!open) setSelectedBeat(null); // closing the panel also clears selection
  };
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
    <div className="fixed inset-0 flex flex-col lg:flex-row bg-brand-900 text-brand-50">
      {/* Map area */}
      <div className="flex-1 relative min-h-0">
        <MapErrorBoundary fallback={<MapFallback />}>
          <CrimeMap
            filters={filters}
            cities={cities}
            selectedBeat={selectedBeat}
            onSelectBeat={setSelectedBeat}
          />
        </MapErrorBoundary>

        {/* Top toolbar */}
        <div className="absolute top-2 sm:top-4 left-2 sm:left-4 right-2 sm:right-4 z-10
                        flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-3 bg-brand-800/90 backdrop-blur-sm
                          border border-brand-700 rounded-lg px-4 py-2.5 shadow-xl flex-shrink-0">
            <ShieldHeart className="w-5 sm:w-6 h-5 sm:h-6 text-accent-400 flex-shrink-0" />
            <div className="min-w-0">
              <div className="font-bold text-base sm:text-lg leading-tight">CommunityShield</div>
              <div className="text-xs text-brand-300 hidden sm:block">Community-led safety</div>
            </div>
            <div className="ml-2 pl-2 sm:ml-3 sm:pl-3 border-l border-brand-700 text-xs flex-shrink-0">
              {error && <span className="text-red-300">offline</span>}
              {!error && health && (
                <span className="text-accent-400">
                  ● <span className="hidden sm:inline">{health.status === "ok" ? "live" : health.status}</span>
                </span>
              )}
              {!error && !health && <span className="text-brand-300">...</span>}
            </div>
          </div>

          <div className="flex-1 flex sm:justify-end overflow-x-auto">
            <FilterBar filters={filters} cities={cities} onChange={setFilters} />
          </div>
        </div>

        {/* Legend (hidden on small screens — too cluttered) */}
        <div className="hidden sm:block absolute bottom-8 left-4 z-10 bg-brand-800/90 backdrop-blur-sm
                        border border-brand-700 rounded-lg px-3 py-2 text-xs shadow-xl">
          <div className="text-brand-300 uppercase tracking-wider mb-1">Incidents</div>
          <div className="flex items-center gap-1">
            <span className="text-brand-400">low</span>
            <div className="w-32 h-2 rounded"
                 style={{ background: "linear-gradient(to right, #1a3d33, #2D5F4F, #7a4e1f, #c97a2e, #E8A04C)" }} />
            <span className="text-brand-400">high</span>
          </div>
        </div>

        {/* Right-side drawer toggle button (mobile/tablet, when closed) */}
        {!panelOpen && (
          <button
            onClick={() => setPanelOpen(true)}
            className="lg:hidden absolute top-1/2 right-0 -translate-y-1/2 z-10
                       bg-accent-400 text-brand-900 font-medium px-3 py-3 shadow-xl
                       rounded-l-lg text-sm flex flex-col items-center gap-1"
            aria-label="Open prediction panel"
          >
            <span aria-hidden className="text-lg leading-none">‹</span>
            <span className="writing-mode-vertical text-xs uppercase tracking-wider"
                  style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
              {selectedBeat ? `Beat ${selectedBeat}` : "Predict"}
            </span>
          </button>
        )}
      </div>

      {/* Side panel — right drawer below lg, fixed sidebar above lg */}
      <div
        className={`
          bg-brand-900 border-brand-700 overflow-y-auto
          lg:w-[28rem] lg:border-l lg:static lg:max-h-none lg:translate-x-0
          fixed top-0 right-0 bottom-0 w-[min(22rem,90vw)] z-20 border-l
          transition-transform duration-300 ease-out
          shadow-2xl lg:shadow-none
          ${panelOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Mobile/tablet drawer header with close button */}
        <div className="lg:hidden sticky top-0 bg-brand-900 border-b border-brand-700 px-4 py-2 flex items-center justify-between z-10">
          <span className="text-sm font-medium text-brand-200">
            {selectedBeat ? `Beat ${selectedBeat}` : "Prediction"}
          </span>
          <button
            onClick={() => setPanelOpen(false)}
            className="text-brand-300 hover:text-brand-100 text-2xl leading-none px-2"
            aria-label="Close panel"
          >
            ×
          </button>
        </div>

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
      <path d="M24 4 L42 10 V24 C42 34 33 42 24 44 C15 42 6 34 6 24 V10 Z"
            fill="currentColor" opacity="0.18" stroke="currentColor" strokeWidth="2" />
      <path d="M24 33 C24 33 14 27 14 20 C14 16.5 16.5 14 20 14 C22 14 23.5 15 24 16.5 C24.5 15 26 14 28 14 C31.5 14 34 16.5 34 20 C34 27 24 33 24 33 Z"
            fill="currentColor" />
    </svg>
  );
}