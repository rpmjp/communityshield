import { useEffect, useState } from "react";
import { getBeatDetail } from "../api/community";
import type { BeatStats } from "../types";

interface Props {
  citySlug: string;
  beatNumber: string;
  year: number;
  onClose: () => void;
  onUsedForPrediction: (initial: {
    beat_num: number;
    district: string;
    latitude: number;
    longitude: number;
    primary_type: string;
  }) => void;
  onStatsLoaded?: (stats: BeatStats) => void;
}

export default function BeatDetailPanel({
  citySlug, beatNumber, year, onClose, onUsedForPrediction, onStatsLoaded,
}: Props) {
  const [stats, setStats] = useState<BeatStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getBeatDetail(citySlug, beatNumber, year)
      .then((data) => {
        if (cancelled) return;
        setStats(data);
        onStatsLoaded?.(data);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error("[BeatDetailPanel] Beat detail failed", e);
        setError("Beat details are unavailable. Try another beat or refresh the data.");
        setStats(null);
      });
    return () => { cancelled = true; };
  }, [citySlug, beatNumber, year, onStatsLoaded]);

  const useForPrediction = () => {
    if (!stats) return;
    const topType = stats.top_crime_types[0]?.primary_type ?? "THEFT";
    const beatNumAsInt = parseInt(stats.beat_number, 10);
    onUsedForPrediction({
      beat_num: isNaN(beatNumAsInt) ? 0 : beatNumAsInt,
      district: stats.district,
      latitude: stats.center.lat,
      longitude: stats.center.lng,
      primary_type: topType,
    });
  };

  return (
    <section className="border border-brand-700 rounded-lg bg-brand-800 overflow-hidden">
      <div className="flex items-start justify-between border-b border-brand-700 px-4 py-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-brand-300">
            Beat {beatNumber}
          </div>
          {stats && (
            <div className="text-sm text-brand-400">
              District {stats.district} · {stats.area_sq_km} km²
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-brand-400 hover:text-brand-100 text-lg leading-none rounded focus:outline-none focus:ring-2 focus:ring-accent-400"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {error && (
        <div className="m-4 text-red-300 bg-red-950/30 border border-red-800 rounded px-3 py-2 text-sm" role="alert">
          We could not load this beat right now. {error}
        </div>
      )}
      {!error && !stats && (
        <div className="p-4 space-y-3" aria-label="Loading beat details">
          <div className="grid grid-cols-3 gap-2">
            <div className="h-14 rounded bg-brand-900 animate-pulse" />
            <div className="h-14 rounded bg-brand-900 animate-pulse" />
            <div className="h-14 rounded bg-brand-900 animate-pulse" />
          </div>
          <div className="h-20 rounded bg-brand-900 animate-pulse" />
          <div className="h-16 rounded bg-brand-900 animate-pulse" />
        </div>
      )}

      {stats && (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Incidents" value={stats.stats.total_incidents.toLocaleString()} />
            <Stat label="Arrests" value={`${(stats.stats.arrest_rate * 100).toFixed(0)}%`} />
            <Stat label="Domestic" value={`${(stats.stats.domestic_rate * 100).toFixed(0)}%`} />
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider text-brand-300 mb-1">
              Top crime types ({year})
            </div>
            {stats.top_crime_types.length === 0 ? (
              <div className="text-sm text-brand-400 border border-dashed border-brand-700 rounded p-3">
                No incident mix is available for this beat and year.
              </div>
            ) : (
              <div className="space-y-1">
                {stats.top_crime_types.map((t) => {
                  const pct = stats.stats.total_incidents > 0
                    ? (t.incidents / stats.stats.total_incidents) * 100
                    : 0;
                  return (
                    <div key={t.primary_type} className="flex items-center gap-2 text-sm">
                      <div className="w-32 truncate text-brand-200" title={t.primary_type}>
                        {t.primary_type}
                      </div>
                      <div className="flex-1 bg-brand-900 rounded h-2 overflow-hidden">
                        <div className="bg-accent-400 h-full" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="w-16 text-right text-brand-300 text-xs">
                        {t.incidents.toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider text-brand-300 mb-1">
              Hour-of-day distribution
            </div>
            <div className="flex items-end gap-0.5 h-16">
              {stats.hour_distribution.map((count, hour) => {
                const max = Math.max(...stats.hour_distribution);
                const pct = max > 0 ? (count / max) * 100 : 0;
                return (
                  <div
                    key={hour}
                    className="flex-1 bg-accent-400 rounded-sm hover:bg-accent-300"
                    style={{ height: `${pct}%`, minHeight: count > 0 ? "2px" : "0" }}
                    title={`${hour}:00 — ${count.toLocaleString()} incidents`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-brand-400 mt-1">
              <span>12am</span>
              <span>6am</span>
              <span>12pm</span>
              <span>6pm</span>
              <span>11pm</span>
            </div>
          </div>

          <button
            onClick={useForPrediction}
            className="w-full bg-brand-700 hover:bg-brand-600 border border-brand-600
                       text-brand-50 text-sm font-medium rounded px-3 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-accent-400"
          >
            Use this beat for prediction
          </button>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-brand-900 rounded p-2">
      <div className="text-lg font-semibold text-accent-400">{value}</div>
      <div className="text-xs text-brand-300 uppercase tracking-wider">{label}</div>
    </div>
  );
}
