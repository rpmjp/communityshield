import { useEffect, useRef, useState } from "react";
import { predictAll } from "../api/predict";
import type { AllPredictionsResponse, PredictionFeatures } from "../api/types";
import ExplanationPanel from "./ExplanationPanel";

export interface PredictionPanelInitial {
  beat_num: number;
  district: string;
  latitude: number;
  longitude: number;
  primary_type: string;
}

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

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface Props {
  initial?: PredictionPanelInitial | null;
}

export default function PredictionPanel({ initial }: Props = {}) {
  const panelRef = useRef<HTMLElement>(null);
  const scrolledInitialRef = useRef(false);
  const [features, setFeatures] = useState<PredictionFeatures>(() =>
    initial ? { ...DEFAULT_FEATURES, ...initial } : DEFAULT_FEATURES
  );
  const [result, setResult] = useState<AllPredictionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Scroll into view on remount when seeded from a beat selection
  useEffect(() => {
    if (!initial || !panelRef.current || scrolledInitialRef.current) return;
    scrolledInitialRef.current = true;
    panelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [initial]);

  const update = <K extends keyof PredictionFeatures>(
    key: K, value: PredictionFeatures[K]
  ) => {
    setFeatures(prev => ({ ...prev, [key]: value }));
    setResult(null);
    setValidationError(null);
  };

  const validate = () => {
    if (!Number.isInteger(features.hour) || features.hour < 0 || features.hour > 23) {
      return "Hour must be a whole number from 0 to 23.";
    }
    if (!Number.isInteger(features.day_of_week) || features.day_of_week < 0 || features.day_of_week > 6) {
      return "Day must be Monday through Sunday.";
    }
    if (!Number.isInteger(features.month) || features.month < 1 || features.month > 12) {
      return "Month must be January through December.";
    }
    if (!Number.isFinite(features.beat_num) || features.beat_num <= 0) {
      return "Beat must be a positive number.";
    }
    if (!Number.isFinite(features.community_area) || features.community_area < 1 || features.community_area > 77) {
      return "Community area must be between 1 and 77 for Chicago.";
    }
    if (!Number.isFinite(features.latitude) || features.latitude < -90 || features.latitude > 90) {
      return "Latitude must be between -90 and 90.";
    }
    if (!Number.isFinite(features.longitude) || features.longitude < -180 || features.longitude > 180) {
      return "Longitude must be between -180 and 180.";
    }
    if (!features.district.trim()) {
      return "District is required.";
    }
    return null;
  };

  const runPrediction = async () => {
    const invalid = validate();
    if (invalid) {
      setValidationError(invalid);
      setResult(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await predictAll(features);
      setResult(res);
    } catch (e) {
      console.error("[PredictionPanel] Prediction failed", e);
      setError(e instanceof Error ? e.message : "Prediction service is unavailable. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section ref={panelRef}
         className="border border-brand-700 rounded-lg bg-brand-800 text-left overflow-hidden">
      <div className="border-b border-brand-700 px-5 py-4 space-y-2">
        <div className="text-sm uppercase tracking-wider text-brand-300">
          Beat Risk Prediction
        </div>
        <p className="text-xs leading-relaxed text-brand-300">
          Probabilities are model estimates for planning and outreach. They are not enforcement decisions or guarantees.
        </p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 gap-3 text-sm p-5">
        <label className="space-y-1">
          <div className="text-brand-300">Hour of day</div>
          <input type="number" min={0} max={23} value={features.hour}
            onChange={e => update("hour", Number(e.target.value))}
            className="w-full bg-brand-900 border border-brand-700 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent-400" />
          <div className="text-[10px] text-brand-500">0-23</div>
        </label>
        <label className="space-y-1">
          <div className="text-brand-300">Day of week</div>
          <select value={features.day_of_week}
            onChange={e => update("day_of_week", Number(e.target.value))}
            className="w-full bg-brand-900 border border-brand-700 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent-400">
            {DAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <div className="text-brand-300">Police beat</div>
          <input type="number" value={features.beat_num}
            onChange={e => update("beat_num", Number(e.target.value))}
            className="w-full bg-brand-900 border border-brand-700 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent-400" />
        </label>
        <label className="space-y-1">
          <div className="text-brand-300">District</div>
          <input value={features.district}
            onChange={e => update("district", e.target.value)}
            className="w-full bg-brand-900 border border-brand-700 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent-400" />
        </label>
        <label className="space-y-1">
          <div className="text-brand-300">Month</div>
          <select value={features.month}
            onChange={e => update("month", Number(e.target.value))}
            className="w-full bg-brand-900 border border-brand-700 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent-400">
            {MONTHS.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <div className="text-brand-300">Community area</div>
          <input type="number" min={1} max={77} value={features.community_area}
            onChange={e => update("community_area", Number(e.target.value))}
            className="w-full bg-brand-900 border border-brand-700 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent-400" />
        </label>
        <label className="space-y-1">
          <div className="text-brand-300">Latitude</div>
          <input type="number" step="0.001" value={features.latitude}
            onChange={e => update("latitude", Number(e.target.value))}
            className="w-full bg-brand-900 border border-brand-700 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent-400" />
        </label>
        <label className="space-y-1">
          <div className="text-brand-300">Longitude</div>
          <input type="number" step="0.001" value={features.longitude}
            onChange={e => update("longitude", Number(e.target.value))}
            className="w-full bg-brand-900 border border-brand-700 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent-400" />
        </label>
        <label className="space-y-1 col-span-2">
          <div className="text-brand-300">Location type</div>
          <select value={features.location_group}
            onChange={e => update("location_group", e.target.value)}
            className="w-full bg-brand-900 border border-brand-700 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent-400">
            {LOCATION_GROUPS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
          </select>
        </label>
        <label className="space-y-1 col-span-2">
          <div className="text-brand-300">Crime type (for arrest/domestic context)</div>
          <select value={features.primary_type}
            onChange={e => update("primary_type", e.target.value)}
            className="w-full bg-brand-900 border border-brand-700 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent-400">
            {PRIMARY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>

        <button onClick={runPrediction} disabled={loading}
          className="col-span-2 w-full bg-accent-400 text-brand-900 font-medium rounded px-4 py-2
                     hover:bg-accent-300 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-accent-200">
          {loading ? "Estimating..." : "Run prediction"}
        </button>

        {validationError && <div className="col-span-2 text-amber-200 bg-amber-900/30 border border-amber-700 rounded px-3 py-2 text-sm" role="alert">{validationError}</div>}
        {error && <div className="col-span-2 text-red-300 bg-red-950/30 border border-red-800 rounded px-3 py-2 text-sm" role="alert">{error}</div>}
      </div>

      {!error && !result && !loading && (
        <div className="mx-5 mb-5 text-xs text-brand-400 text-center py-3 border border-dashed border-brand-700 rounded">
          Set the visible model features above, then run a prediction to see estimated probabilities.
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-3 p-5 pt-4 border-t border-brand-700">
          <div className="space-y-1">
            <Metric label="Arrest probability"
              value={result.arrest.probability}
              highlight={result.arrest.prediction === 1} />
            {result.arrest.explanation && (
              <ExplanationPanel title="Arrest" explanation={result.arrest.explanation} />
            )}
          </div>
          <div className="space-y-1">
            <Metric label="Domestic probability"
              value={result.domestic.probability}
              highlight={result.domestic.prediction === 1} />
            {result.domestic.explanation && (
              <ExplanationPanel title="Domestic" explanation={result.domestic.explanation} />
            )}
          </div>
          <div className="space-y-1">
            <Metric label="Property crime probability"
              value={result.property_binary.probability}
              highlight={result.property_binary.prediction === 1} />
            {result.property_binary.explanation && (
              <ExplanationPanel title="Property" explanation={result.property_binary.explanation} />
            )}
          </div>

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
    </section>
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
