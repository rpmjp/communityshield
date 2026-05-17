// Shared types across the app

export interface HeatmapFilters {
  city_slug: string;
  year: number;
  hour_min: number;
  hour_max: number;
  primary_type: string | null; // null = all
}

export interface BeatStats {
  beat_number: string;
  district: string;
  center: { lat: number; lng: number };
  area_sq_km: number;
  year: number;
  stats: {
    total_incidents: number;
    total_arrests: number;
    total_domestic: number;
    arrest_rate: number;
    domestic_rate: number;
  };
  top_crime_types: { primary_type: string; incidents: number }[];
  hour_distribution: number[];
}

export interface HeatmapBeat {
  beat_number: string;
  incident_count: number;
  arrest_count: number;
  domestic_count: number;
}

export interface HeatmapResponse {
  city_slug: string;
  filters: Record<string, unknown>;
  beats: HeatmapBeat[];
  total_incidents: number;
  max_beat_incidents: number;
}

export interface CrimeTypeOption {
  primary_type: string;
  incident_count: number;
}

export interface CityBounds {
  min_lat: number;
  max_lat: number;
  min_lng: number;
  max_lng: number;
}

export interface City {
  slug: string;
  name: string;
  beat_count: number;
  bounds: CityBounds;
  center: { lat: number; lng: number };
}