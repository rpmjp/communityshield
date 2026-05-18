import { lazy, Suspense, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import BeatDetailPanel from "./components/BeatDetailPanel";
import OnboardingOverlay from "./components/OnboardingOverlay";
import FilterBar from "./components/FilterBar";
import MapErrorBoundary from "./components/MapErrorBoundary";
import PredictionPanel, { type PredictionPanelInitial } from "./components/PredictionPanel";
import type { City, HeatmapFilters } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";
const DEFAULT_FILTERS: HeatmapFilters = {
  city_slug: "chicago",
  year: 2024,
  hour_min: 0,
  hour_max: 23,
  primary_type: null,
};
const CrimeMap = lazy(() => import("./components/CrimeMap"));
const MapFallback = lazy(() => import("./components/MapFallback"));

type Health = { status: string; database: string };

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [selectedBeat, setSelectedBeat] = useState<string | null>(null);
  const [predictionInitial, setPredictionInitial] = useState<PredictionPanelInitial | null>(null);
  const [manualPanelOpen, setManualPanelOpen] = useState(false);
  const panelOpen = manualPanelOpen || selectedBeat !== null;
  const setPanelOpen = (open: boolean) => {
    setManualPanelOpen(open);
    if (!open) setSelectedBeat(null);
  };
  const [filters, setFilters] = useState<HeatmapFilters>(DEFAULT_FILTERS);

  useEffect(() => {
    fetch(`${API_BASE}/health/db`)
      .then((r) => {
        if (!r.ok) throw new Error("health check failed");
        return r.json();
      })
      .then(setHealth)
      .catch(() => setError("offline"));
    fetch(`${API_BASE}/cities`)
      .then((r) => {
        if (!r.ok) throw new Error("cities unavailable");
        return r.json();
      })
      .then(setCities)
      .catch(() => setCities([]));
  }, []);

  const resetFilters = () => setFilters(DEFAULT_FILTERS);
  const filtersChanged = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  return (
    <>
      <OnboardingOverlay />
      <div className="fixed inset-0 flex flex-col lg:flex-row bg-brand-900 text-brand-50">
        {/* Map area */}
        <div className="flex-1 relative min-h-0">
          <Suspense fallback={<MapLoading />}>
            <MapErrorBoundary
              fallback={
                <Suspense fallback={<MapLoading />}>
                  <MapFallback
                    filters={filters}
                    cities={cities}
                    selectedBeat={selectedBeat}
                    onSelectBeat={setSelectedBeat}
                  />
                </Suspense>
              }
            >
              <CrimeMap
                filters={filters}
                cities={cities}
                selectedBeat={selectedBeat}
                onSelectBeat={setSelectedBeat}
              />
            </MapErrorBoundary>
          </Suspense>

          {/* Top toolbar */}
          <div className="absolute top-2 sm:top-4 left-2 sm:left-4 right-2 sm:right-4 z-10
                          flex flex-col xl:flex-row items-stretch xl:items-center gap-2 xl:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 bg-brand-800/90 backdrop-blur-sm
                            border border-brand-700 rounded-lg px-3 sm:px-4 py-2 sm:py-2.5
                            shadow-xl flex-shrink-0">
              <ShieldHeart className="w-5 sm:w-6 h-5 sm:h-6 text-accent-400 flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-bold text-sm sm:text-base lg:text-lg leading-tight whitespace-nowrap">
                  CommunityShield
                </div>
                <div className="text-[10px] sm:text-xs text-brand-300 hidden lg:block">
                  Community-led safety
                </div>
              </div>
              <div
                className="pl-2 sm:pl-3 border-l border-brand-700 text-xs flex-shrink-0"
                role="status"
                aria-label={error ? "API offline" : health ? "API online" : "Checking API status"}
              >
                {error && <span className="text-red-300">offline</span>}
                {!error && health && (
                  <span className="text-accent-400" aria-hidden="true">●</span>
                )}
                {!error && !health && <span className="text-brand-300">…</span>}
              </div>
              <Link
                to="/methodology"
                className="pl-2 sm:pl-3 border-l border-brand-700 text-xs text-brand-300 hover:text-accent-400 flex-shrink-0 whitespace-nowrap rounded focus:outline-none focus:ring-2 focus:ring-accent-400"
              >
                Methodology
              </Link>
            </div>

            <div className="flex-1 flex sm:justify-end min-w-0">
              <FilterBar filters={filters} cities={cities} onChange={setFilters} onReset={resetFilters} />
            </div>
          </div>

          {/* Legend */}
          <div className="hidden sm:block absolute bottom-8 left-4 z-10 bg-brand-800/90 backdrop-blur-sm
                          border border-brand-700 rounded-lg px-3 py-2 text-xs shadow-xl"
               aria-label="Incident color legend">
            <div className="text-brand-300 uppercase tracking-wider mb-1">Incidents for filters</div>
            <div className="flex items-center gap-1">
              <span className="text-brand-400">low</span>
              <div className="w-32 h-2 rounded"
                   style={{ background: "linear-gradient(to right, #1a3d33, #2D5F4F, #7a4e1f, #c97a2e, #E8A04C)" }} />
              <span className="text-brand-400">high</span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-3 text-[11px] text-brand-400">
              <span>{filters.year} · {filters.primary_type ?? "all types"}</span>
              {filtersChanged && (
                <button
                  onClick={resetFilters}
                  className="text-accent-300 hover:text-accent-200 focus:outline-none focus:ring-2 focus:ring-accent-400 rounded"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Right-side drawer toggle button */}
          {!panelOpen && (
            <button
              onClick={() => setPanelOpen(true)}
              className="lg:hidden absolute top-1/2 right-0 -translate-y-1/2 z-10
                         bg-accent-400 text-brand-900 font-medium px-3 py-3 shadow-xl
                         rounded-l-lg text-sm flex flex-col items-center gap-1"
              aria-label="Open prediction panel"
            >
              <span aria-hidden className="text-lg leading-none">‹</span>
              <span className="text-xs uppercase tracking-wider"
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
          aria-label="Prediction and beat details panel"
        >
          <div className="lg:hidden sticky top-0 bg-brand-900 border-b border-brand-700 px-4 py-2 flex items-center justify-between z-10">
            <span className="text-sm font-medium text-brand-200">
              {selectedBeat ? `Beat ${selectedBeat}` : "Prediction"}
            </span>
            <button
              onClick={() => setPanelOpen(false)}
              className="text-brand-300 hover:text-brand-100 text-2xl leading-none px-2 rounded focus:outline-none focus:ring-2 focus:ring-accent-400"
              aria-label="Close panel"
            >
              ×
            </button>
          </div>

          <div className="p-4 space-y-4">
            <section className="border border-brand-700 rounded-lg bg-brand-800 px-4 py-3">
              <div className="text-xs uppercase tracking-wider text-brand-300">
                Planning context
              </div>
              <p className="mt-1 text-xs leading-relaxed text-brand-300">
                Use the map and model outputs to spot patterns for prevention, services, and resource planning. Treat every estimate as context that needs local review.
              </p>
            </section>
            {selectedBeat && (
              <BeatDetailPanel
                key={`${filters.city_slug}-${selectedBeat}-${filters.year}`}
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
    </>
  );
}

function MapLoading() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-brand-900 text-brand-300 text-sm">
      Loading map...
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
