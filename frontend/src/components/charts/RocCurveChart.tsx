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
    <div className="bg-brand-800 border border-brand-700 rounded-lg p-3 sm:p-4 min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-1 mb-3">
        <h4 className="text-sm font-semibold text-brand-100 truncate">{title}</h4>
        <span className="text-[11px] sm:text-xs text-brand-300">
          AUC <span className="text-accent-400 font-mono font-semibold">{auc.toFixed(3)}</span>
        </span>
      </div>
      <div className="h-48 sm:h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 6, left: -28, bottom: 0 }}>
            <CartesianGrid stroke="#244D40" strokeDasharray="2 4" />
            <XAxis
              type="number"
              dataKey="fpr"
              domain={[0, 1]}
              ticks={[0, 0.5, 1]}
              tick={{ fill: "#76A593", fontSize: 10 }}
              stroke="#1B3B31"
            />
            <YAxis
              type="number"
              domain={[0, 1]}
              ticks={[0, 0.5, 1]}
              tick={{ fill: "#76A593", fontSize: 10 }}
              stroke="#1B3B31"
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
      <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] uppercase tracking-wider text-brand-400 sm:text-[11px]">
        <span>False positive rate</span>
        <span className="text-right">True positive rate</span>
      </div>
    </div>
  );
}
