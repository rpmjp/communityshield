import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Feature {
  feature: string;
  importance: number;
}

interface Props {
  data: Feature[];
  title: string;
  color?: string;
}

// Map encoded feature names to human-readable labels
const FEATURE_LABELS: Record<string, string> = {
  hour: "Hour of day",
  day_of_week: "Day of week",
  month: "Month",
  is_weekend: "Weekend",
  quarter: "Quarter",
  shift: "Shift",
  beat_num: "Beat",
  community_area: "Community area",
  latitude: "Latitude",
  longitude: "Longitude",
  district_enc: "Police district",
  location_enc: "Location type",
  type_enc: "Crime type",
};

export default function FeatureImportanceChart({ data, title, color = "#E8A04C" }: Props) {
  const labeled = data.map((d) => ({
    ...d,
    label: FEATURE_LABELS[d.feature] ?? d.feature,
  }));

  return (
    <div className="bg-brand-800 border border-brand-700 rounded-lg p-4">
      <h4 className="text-sm font-semibold text-brand-100 mb-3">{title}</h4>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={labeled}
            layout="vertical"
            margin={{ top: 5, right: 20, left: 90, bottom: 5 }}
          >
            <CartesianGrid stroke="#244D40" strokeDasharray="2 4" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: "#76A593", fontSize: 11 }}
              stroke="#1B3B31"
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fill: "#A4C3B6", fontSize: 11 }}
              stroke="#1B3B31"
              width={90}
              interval={0}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#132A23", border: "1px solid #244D40",
                borderRadius: "4px", fontSize: "11px",
              }}
              labelStyle={{ color: "#76A593" }}
              formatter={(value: number) => value.toFixed(2)}
            />
            <Bar dataKey="importance" fill={color} radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="text-xs text-brand-400 mt-2 italic">
        XGBoost gain — total gain across splits using this feature
      </div>
    </div>
  );
}