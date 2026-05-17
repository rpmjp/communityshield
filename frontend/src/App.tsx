import { useEffect, useState } from "react";
import CrimeMap from "./components/CrimeMap";
import MapErrorBoundary from "./components/MapErrorBoundary";
import MapFallback from "./components/MapFallback";
import PredictionPanel from "./components/PredictionPanel";

type Health = { status: string; database: string };

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const base = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";
    fetch(`${base}/health/db`)
      .then((r) => r.json())
      .then(setHealth)
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <div className="fixed inset-0 flex bg-brand-900 text-brand-50">
      {/* Map area */}
      <div className="flex-1 relative">
        <MapErrorBoundary fallback={<MapFallback />}>
          <CrimeMap />
        </MapErrorBoundary>

        {/* Floating header */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-3 bg-brand-800/90 backdrop-blur-sm
                        border border-brand-700 rounded-lg px-4 py-2.5 shadow-xl">
          <ShieldHeart className="w-6 h-6 text-accent-400" />
          <div>
            <div className="font-bold text-lg leading-tight">CommunityShield</div>
            <div className="text-xs text-brand-300">Chicago · Community-led safety</div>
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
      </div>

      {/* Side panel */}
      <div className="w-[28rem] border-l border-brand-700 overflow-y-auto">
        <div className="p-4 space-y-4">
          <PredictionPanel />
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