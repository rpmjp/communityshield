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
  const labeled = data.slice(0, 8).map((d) => ({
    ...d,
    label: FEATURE_LABELS[d.feature] ?? d.feature,
    shortLabel: (FEATURE_LABELS[d.feature] ?? d.feature)
      .replace("Community area", "Community")
      .replace("Police district", "District")
      .replace("Location type", "Location")
      .replace("Crime type", "Type"),
  }));

  return (
    <div className="bg-brand-800 border border-brand-700 rounded-lg p-3 sm:p-4 min-w-0">
      <h4 className="text-sm font-semibold text-brand-100 mb-3 truncate">{title}</h4>
      <div className="h-56 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={labeled}
            layout="vertical"
            margin={{ top: 5, right: 8, left: 64, bottom: 5 }}
          >
            <CartesianGrid stroke="#244D40" strokeDasharray="2 4" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: "#76A593", fontSize: 11 }}
              stroke="#1B3B31"
            />
            <YAxis
              type="category"
              dataKey="shortLabel"
              tick={{ fill: "#A4C3B6", fontSize: 10 }}
              stroke="#1B3B31"
              width={68}
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
      <div className="text-[11px] sm:text-xs text-brand-400 mt-2 leading-relaxed">
        XGBoost gain across splits. Showing top 8 features for readability.
      </div>
    </div>
  );
}
