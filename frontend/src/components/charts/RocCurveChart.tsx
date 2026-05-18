import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface RocPoint {
  fpr: number;
  tpr: number;
}

interface Props {
  data: RocPoint[];
  auc: number;
  title: string;
  color?: string;
}

export default function RocCurveChart({ data, auc, title, color = "#E8A04C" }: Props) {
  return (
    <div className="bg-brand-800 border border-brand-700 rounded-lg p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h4 className="text-sm font-semibold text-brand-100">{title}</h4>
        <span className="text-xs text-brand-300">
          AUC <span className="text-accent-400 font-mono font-semibold">{auc.toFixed(3)}</span>
        </span>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid stroke="#244D40" strokeDasharray="2 4" />
            <XAxis
              type="number"
              dataKey="fpr"
              domain={[0, 1]}
              ticks={[0, 0.25, 0.5, 0.75, 1]}
              tick={{ fill: "#76A593", fontSize: 11 }}
              stroke="#1B3B31"
              label={{ value: "False positive rate", position: "insideBottom", offset: -2,
                       fill: "#76A593", fontSize: 11 }}
            />
            <YAxis
              type="number"
              domain={[0, 1]}
              ticks={[0, 0.25, 0.5, 0.75, 1]}
              tick={{ fill: "#76A593", fontSize: 11 }}
              stroke="#1B3B31"
              label={{ value: "True positive rate", angle: -90, position: "insideLeft",
                       fill: "#76A593", fontSize: 11, offset: 15 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#132A23", border: "1px solid #244D40",
                borderRadius: "4px", fontSize: "11px",
              }}
              labelStyle={{ color: "#76A593" }}
              formatter={(value: number) => value.toFixed(3)}
            />
            <ReferenceLine
              segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
              stroke="#4F8772" strokeDasharray="3 3"
            />
            <Line
              type="monotone"
              dataKey="tpr"
              stroke={color}
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}