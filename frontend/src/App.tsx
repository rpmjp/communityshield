import { useEffect, useState } from "react";

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
    <div className="min-h-full bg-brand-900 text-brand-50 flex items-center justify-center px-6 py-12">
      <div className="max-w-xl w-full text-center space-y-8">
        <div className="flex items-center justify-center gap-3">
          <ShieldHeart className="w-12 h-12 text-accent-400" />
          <h1 className="text-4xl font-bold tracking-tight">CommunityShield</h1>
        </div>

        <p className="text-brand-200 text-lg leading-relaxed">
          Community-led public safety. Local crime patterns. Evidence-based prevention.
        </p>

        <div className="border border-brand-700 rounded-lg p-6 bg-brand-800 text-left">
          <div className="text-sm uppercase tracking-wider text-brand-300 mb-2">
            Backend status
          </div>
          {error && <div className="text-red-300">Backend not reachable: {error}</div>}
          {!error && !health && <div className="text-brand-300">Checking...</div>}
          {health && (
            <div className="space-y-1">
              <div>
                <span className="text-brand-300">API:</span>{" "}
                <span className="text-accent-400 font-medium">{health.status}</span>
              </div>
              <div>
                <span className="text-brand-300">Database:</span>{" "}
                <span className="text-accent-400 font-medium">{health.database}</span>
              </div>
            </div>
          )}
        </div>

        <div className="text-xs text-brand-400">
          Phase 0 foundation. Chicago seeded. Map coming next.
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
