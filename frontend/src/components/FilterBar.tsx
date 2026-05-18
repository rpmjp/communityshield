import { useEffect, useState } from "react";
import type { City, CrimeTypeOption, HeatmapFilters } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

interface Props {
  filters: HeatmapFilters;
  cities: City[];
  onChange: (filters: HeatmapFilters) => void;
  onReset: () => void;
}

const HOUR_PRESETS: { label: string; min: number; max: number }[] = [
  { label: "All day", min: 0, max: 23 },
  { label: "Day", min: 7, max: 14 },
  { label: "Evening", min: 15, max: 22 },
  { label: "Night", min: 23, max: 6 },
];

const YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015];

export default function FilterBar({ filters, cities, onChange, onReset }: Props) {
  const [crimeTypesState, setCrimeTypesState] = useState<{
    citySlug: string;
    status: "loading" | "ready" | "error";
    items: CrimeTypeOption[];
  }>({ citySlug: filters.city_slug, status: "loading", items: [] });

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/heatmap/crime_types?city_slug=${filters.city_slug}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setCrimeTypesState({
          citySlug: filters.city_slug,
          status: "ready",
          items: data,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setCrimeTypesState({
          citySlug: filters.city_slug,
          status: "error",
          items: [],
        });
      });
    return () => { cancelled = true; };
  }, [filters.city_slug]);

  const presetActive = (min: number, max: number) =>
    filters.hour_min === min && filters.hour_max === max;
  const crimeTypesLoading = crimeTypesState.citySlug !== filters.city_slug
    || crimeTypesState.status === "loading";
  const crimeTypesError = crimeTypesState.citySlug === filters.city_slug
    && crimeTypesState.status === "error";
  const crimeTypes = crimeTypesState.citySlug === filters.city_slug
    ? crimeTypesState.items
    : [];

  return (
    <div
      className="bg-brand-800/95 backdrop-blur-sm border border-brand-700 rounded-lg
                 px-4 py-3 shadow-xl flex items-center gap-4 text-sm flex-wrap"
      aria-label="Map filters"
    >
      {/* City selector */}
      <label className="flex items-center gap-2">
        <span className="text-brand-300">City</span>
        <select
          value={filters.city_slug}
          onChange={(e) => onChange({ ...filters, city_slug: e.target.value })}
          className="bg-brand-900 border border-brand-700 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent-400"
          disabled={cities.length <= 1}
        >
          {cities.length === 0 && <option value={filters.city_slug}>Loading cities</option>}
          {cities.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </select>
      </label>

      {/* Year */}
      <label className="flex items-center gap-2">
        <span className="text-brand-300">Year</span>
        <select
          value={filters.year}
          onChange={(e) => onChange({ ...filters, year: Number(e.target.value) })}
          className="bg-brand-900 border border-brand-700 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent-400"
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </label>

      {/* Crime type */}
      <label className="flex items-center gap-2">
        <span className="text-brand-300">Type</span>
        <select
          value={filters.primary_type ?? ""}
          onChange={(e) =>
            onChange({ ...filters, primary_type: e.target.value || null })
          }
          className="bg-brand-900 border border-brand-700 rounded px-2 py-1 max-w-[12rem] focus:outline-none focus:ring-2 focus:ring-accent-400"
          disabled={crimeTypesLoading || crimeTypesError}
        >
          <option value="">
            {crimeTypesLoading ? "Loading types" : crimeTypesError ? "Types unavailable" : "All types"}
          </option>
          {crimeTypes.map((t) => (
            <option key={t.primary_type} value={t.primary_type}>
              {t.primary_type}
            </option>
          ))}
        </select>
      </label>

      {/* Hour presets */}
      <div className="flex items-center gap-1">
        <span className="text-brand-300 mr-2">Time</span>
        {HOUR_PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => onChange({ ...filters, hour_min: p.min, hour_max: p.max })}
          className={`px-2 py-1 rounded text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-accent-400 ${
              presetActive(p.min, p.max)
                ? "bg-accent-400 text-brand-900 font-medium"
                : "bg-brand-900 border border-brand-700 text-brand-200 hover:bg-brand-700"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <button
        onClick={onReset}
        className="text-xs text-brand-300 hover:text-accent-300 border border-brand-700 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent-400"
      >
        Reset
      </button>
    </div>
  );
}
