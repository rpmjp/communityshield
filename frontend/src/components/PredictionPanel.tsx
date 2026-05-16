import { useState } from "react";
import { predictAll } from "../api/predict";
import type { AllPredictionsResponse, PredictionFeatures } from "../api/types";

const DEFAULT_FEATURES: PredictionFeatures = {
  hour: 22,
  day_of_week: 5,
  month: 7,
  beat_num: 1832,
  community_area: 32,
  latitude: 41.881,
  longitude: -87.623,
  district: "1",
  location_group: "STREET",
  primary_type: "THEFT",
};

const PRIMARY_TYPES = [
  "THEFT", "BATTERY", "CRIMINAL DAMAGE", "ASSAULT", "DECEPTIVE PRACTICE",
  "MOTOR VEHICLE THEFT", "NARCOTICS", "BURGLARY", "ROBBERY", "WEAPONS VIOLATION",
];

const LOCATION_GROUPS = [
  "STREET", "RESIDENCE", "APARTMENT", "SIDEWALK", "OTHER",
  "SMALL RETAIL STORE", "RESTAURANT", "ALLEY", "PARKING LOT/GARAGE(NON.RESID.)",
];

export default function PredictionPanel() {
  const [features, setFeatures] = useState<PredictionFeatures>(DEFAULT_FEATURES);
  const [result, setResult] = useState<AllPredictionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof PredictionFeatures>(
    key: K, value: PredictionFeatures[K]
  ) => setFeatures(prev => ({ ...prev, [key]: value }));

  const runPrediction = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await predictAll(features);
      setResult(res);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-brand-700 rounded-lg p-6 bg-brand-800 text-left space-y-4">
      <div className="text-sm uppercase tracking-wider text-brand-300">
        Beat Risk Prediction
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <label className="space-y-1">
          <div className="text-brand-300">Hour (0-23)</div>
          <input type="number" min={0} max={23} value={features.hour}
            onChange={e => update("hour", Number(e.target.value))}
            className="w-full bg-brand-900 border border-brand-700 rounded px-2 py-1" />
        </label>
        <label className="space-y-1">
          <div className="text-brand-300">Day (0=Mon)</div>
          <input type="number" min={0} max={6} value={features.day_of_week}
            onChange={e => update("day_of_week", Number(e.target.value))}
            className="w-full bg-brand-900 border border-brand-700 rounded px-2 py-1" />
        </label>
        <label className="space-y-1">
          <div className="text-brand-300">Beat</div>
          <input type="number" value={features.beat_num}
            onChange={e => update("beat_num", Number(e.target.value))}
            className="w-full bg-brand-900 border border-brand-700 rounded px-2 py-1" />
        </label>
        <label className="space-y-1">
          <div className="text-brand-300">District</div>
          <input value={features.district}
            onChange={e => update("district", e.target.value)}
            className="w-full bg-brand-900 border border-brand-700 rounded px-2 py-1" />
        </label>
        <label className="space-y-1 col-span-2">
          <div className="text-brand-300">Location type</div>
          <select value={features.location_group}
            onChange={e => update("location_group", e.target.value)}
            className="w-full bg-brand-900 border border-brand-700 rounded px-2 py-1">
            {LOCATION_GROUPS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
          </select>
        </label>
        <label className="space-y-1 col-span-2">
          <div className="text-brand-300">Crime type (for arrest/domestic context)</div>
          <select value={features.primary_type}
            onChange={e => update("primary_type", e.target.value)}
            className="w-full bg-brand-900 border border-brand-700 rounded px-2 py-1">
            {PRIMARY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>

      <button onClick={runPrediction} disabled={loading}
        className="w-full bg-accent-400 text-brand-900 font-medium rounded px-4 py-2
                   hover:bg-accent-300 disabled:opacity-50">
        {loading ? "Predicting..." : "Run prediction"}
      </button>

      {error && <div className="text-red-300 text-sm">{error}</div>}

      {/* Results */}
      {result && (
        <div className="space-y-3 pt-2 border-t border-brand-700">
          <Metric label="Arrest probability"
            value={result.arrest.probability}
            highlight={result.arrest.prediction === 1} />
          <Metric label="Domestic probability"
            value={result.domestic.probability}
            highlight={result.domestic.prediction === 1} />
          <Metric label="Property crime probability"
            value={result.property_binary.probability}
            highlight={result.property_binary.prediction === 1} />

          <div className="pt-2">
            <div className="text-brand-300 text-xs uppercase tracking-wider mb-2">
              Top 5 likely crime types
            </div>
            <div className="space-y-1">
              {result.crime_type.top_k.map(({ class: cls, probability }) => (
                <div key={cls} className="flex items-center gap-2 text-sm">
                  <div className="w-40 truncate text-brand-200">{cls}</div>
                  <div className="flex-1 bg-brand-900 rounded h-2 overflow-hidden">
                    <div className="bg-accent-400 h-full"
                      style={{ width: `${probability * 100}%` }} />
                  </div>
                  <div className="w-12 text-right text-brand-300 text-xs">
                    {(probability * 100).toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, highlight }: {
  label: string; value: number; highlight: boolean;
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="w-44 text-brand-300">{label}</div>
      <div className="flex-1 bg-brand-900 rounded h-2 overflow-hidden">
        <div className={highlight ? "bg-accent-400 h-full" : "bg-brand-600 h-full"}
          style={{ width: `${value * 100}%` }} />
      </div>
      <div className="w-14 text-right font-medium">
        {(value * 100).toFixed(1)}%
      </div>
    </div>
  );
}