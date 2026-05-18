import { useEffect, useMemo, useState } from "react";
import { getBeatOptions, type BeatOption } from "../api/community";

interface Props {
  citySlug: string;
  selectedBeat: string | null;
  onSelectBeat: (beatNumber: string) => void;
}

export default function BeatSearch({ citySlug, selectedBeat, onSelectBeat }: Props) {
  const [beats, setBeats] = useState<BeatOption[]>([]);
  const [query, setQuery] = useState(selectedBeat ?? "");
  const [loadState, setLoadState] = useState<{
    citySlug: string;
    status: "ready" | "error";
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getBeatOptions(citySlug)
      .then((options) => {
        if (cancelled) return;
        setBeats(options);
        setLoadState({ citySlug, status: "ready" });
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("[BeatSearch] Beat options failed", error);
        setBeats([]);
        setLoadState({ citySlug, status: "error" });
      });
    return () => { cancelled = true; };
  }, [citySlug]);

  const status = loadState?.citySlug === citySlug ? loadState.status : "loading";

  const matches = useMemo(() => {
    const normalized = query.trim();
    if (!normalized) return beats.slice(0, 6);
    return beats
      .filter((beat) => beat.beatNumber.includes(normalized))
      .slice(0, 6);
  }, [beats, query]);

  const choose = (beatNumber: string) => {
    setQuery(beatNumber);
    onSelectBeat(beatNumber);
  };

  return (
    <section className="border border-brand-700 rounded-lg bg-brand-800 px-4 py-3 space-y-3">
      <div>
        <div className="text-xs uppercase tracking-wider text-brand-300">Find a beat</div>
        <p className="mt-1 text-xs text-brand-400">
          Keyboard alternative to selecting polygons on the map.
        </p>
      </div>
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="beat-search">Beat number</label>
        <input
          id="beat-search"
          value={query}
          onChange={(event) => setQuery(event.target.value.replace(/\D/g, "").slice(0, 4))}
          onKeyDown={(event) => {
            if (event.key === "Enter" && matches[0]) choose(matches[0].beatNumber);
          }}
          placeholder={status === "loading" ? "Loading beats" : "Beat number"}
          className="min-w-0 flex-1 bg-brand-900 border border-brand-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-400"
          disabled={status !== "ready"}
        />
        <button
          onClick={() => matches[0] && choose(matches[0].beatNumber)}
          disabled={status !== "ready" || matches.length === 0}
          className="bg-brand-700 hover:bg-brand-600 disabled:opacity-50 border border-brand-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-400"
        >
          Select
        </button>
      </div>
      {status === "error" && (
        <div className="text-xs text-red-300" role="alert">
          Beat search is unavailable right now.
        </div>
      )}
      {status === "ready" && matches.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {matches.map((beat) => (
            <button
              key={beat.beatNumber}
              onClick={() => choose(beat.beatNumber)}
              className={`rounded border px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-accent-400 ${
                beat.beatNumber === selectedBeat
                  ? "border-accent-400 bg-accent-400 text-brand-900"
                  : "border-brand-700 bg-brand-900 text-brand-200 hover:border-brand-500"
              }`}
            >
              Beat {beat.beatNumber}
              {beat.district && <span className="ml-1 opacity-70">D{beat.district}</span>}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
