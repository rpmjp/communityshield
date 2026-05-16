// Match backend Pydantic schemas in app/schemas/prediction.py

export interface PredictionFeatures {
  hour: number;           // 0-23
  day_of_week: number;    // 0=Mon, 6=Sun
  month: number;          // 1-12
  beat_num: number;
  community_area: number; // 1-77
  latitude: number;
  longitude: number;
  district: string;
  location_group?: string; // default "OTHER"
  primary_type?: string;   // required for arrest/domestic
}

export interface BinaryPrediction {
  model: string;
  probability: number;
  prediction: number; // 0 or 1
  threshold: number;
  label?: string | null;
}

export interface CrimeTypePrediction {
  class: string;
  probability: number;
}

export interface CrimeTypeResponse {
  model: string;
  top_k: CrimeTypePrediction[];
  supercategory_probabilities: Record<string, number>;
}

export interface AllPredictionsResponse {
  arrest: BinaryPrediction;
  domestic: BinaryPrediction;
  property_binary: BinaryPrediction;
  crime_type: CrimeTypeResponse;
}