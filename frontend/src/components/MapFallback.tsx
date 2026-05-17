import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

interface BeatRow {
  beat_number: string;
  incident_count: number;
  arrest_count: number;
  domestic_count: number;
}

export default function MapFallback() {
  const [beats, setBeats] = useState<BeatRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/heatmap?year=2024`)
      .then((r) => r.json())
      .then((d) => {
        const sorted = [...d.beats].sort(
          (a: BeatRow, b: BeatRow) => b.incident_count - a.incident_count
        );
        setBeats(sorted);
      })
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <div className="h-full overflow-y-auto bg-brand-900 text-brand-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-4 mb-6">
          <div className="font-bold text-amber-200 mb-1">
            Map view unavailable
          </div>
          <div className="text-sm text-amber-100/80">
            Your browser couldn't initialize WebGL, which is needed for the
            interactive map. The data is shown below as a sortable table instead.
            To enable the map, try a different browser or check that hardware
            acceleration is enabled in your browser settings.
          </div>
        </div>

        <h2 className="text-xl font-bold mb-3">
          Chicago beats by 2024 incident volume
        </h2>

        {error && <div className="text-red-300">Failed to load data: {error}</div>}
        {!error && !beats && <div className="text-brand-300">Loading...</div>}

        {beats && (
          <div className="border border-brand-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-brand-800 text-brand-300 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2 text-left">Beat</th>
                  <th className="px-4 py-2 text-right">Incidents</th>
                  <th className="px-4 py-2 text-right">Arrests</th>
                  <th className="px-4 py-2 text-right">Domestic</th>
                  <th className="px-4 py-2 text-right">Arrest rate</th>
                </tr>
              </thead>
              <tbody>
                {beats.slice(0, 50).map((b) => (
                  <tr key={b.beat_number} className="border-t border-brand-800 hover:bg-brand-800/50">
                    <td className="px-4 py-2 font-mono">{b.beat_number}</td>
                    <td className="px-4 py-2 text-right">{b.incident_count.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right">{b.arrest_count.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right">{b.domestic_count.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right">
                      {b.incident_count > 0
                        ? `${((b.arrest_count / b.incident_count) * 100).toFixed(1)}%`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {beats.length > 50 && (
              <div className="px-4 py-2 text-xs text-brand-300 bg-brand-800 border-t border-brand-700">
                Showing top 50 of {beats.length} beats
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}