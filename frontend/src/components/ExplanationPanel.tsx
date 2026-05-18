import type { PredictionExplanation } from "../api/types";

interface Props {
  title: string;
  explanation: PredictionExplanation;
}

export default function ExplanationPanel({ title, explanation }: Props) {
  const max = Math.max(...explanation.contributions.map((c) => Math.abs(c.shap)), 0.0001);

  return (
    <details className="bg-brand-900/60 border border-brand-700 rounded text-xs">
      <summary className="cursor-pointer px-3 py-1.5 text-brand-300 hover:text-brand-100 select-none rounded focus:outline-none focus:ring-2 focus:ring-accent-400">
        Why? · {title}
      </summary>
      <div className="px-3 pb-3 pt-1 space-y-1.5">
        <div className="text-brand-400 text-[10px] uppercase tracking-wider">
          Top features pushing the prediction
        </div>
        {explanation.contributions.map((c) => {
          const pct = (Math.abs(c.shap) / max) * 100;
          const isPositive = c.shap > 0;
          return (
            <div key={c.feature} className="flex items-center gap-2">
              <div className="w-28 truncate text-brand-200" title={c.label}>
                {c.label}
              </div>
              <div className="flex-1 relative h-2 bg-brand-800 rounded overflow-hidden">
                <div className="absolute top-0 left-1/2 w-px h-full bg-brand-600" />
                <div
                  className={`absolute top-0 h-full ${
                    isPositive ? "bg-accent-400" : "bg-red-400/70"
                  }`}
                  style={{
                    width: `${pct / 2}%`,
                    left: isPositive ? "50%" : `${50 - pct / 2}%`,
                  }}
                />
              </div>
              <div
                className={`w-12 text-right font-mono ${
                  isPositive ? "text-accent-400" : "text-red-300"
                }`}
              >
                {isPositive ? "+" : ""}
                {c.shap.toFixed(2)}
              </div>
            </div>
          );
        })}
        <div className="text-brand-400 text-[10px] pt-1 italic">
          Amber = pushes probability up · Red = pushes it down
        </div>
      </div>
    </details>
  );
}
