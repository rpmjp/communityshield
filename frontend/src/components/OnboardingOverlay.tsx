import { useState } from "react";

const STORAGE_KEY = "cs_onboarding_dismissed_v1";

const STEPS = [
  {
    title: "Welcome to CommunityShield",
    body: "An ML-powered crime pattern explorer for Chicago. 8.5M incidents, 274 police beats, 4 trained models.",
    highlight: null,
  },
  {
    title: "Filter the heatmap",
    body: "Use the top toolbar to filter by year, crime type, and time of day. The map recolors beats by incident density.",
    highlight: "top",
  },
  {
    title: "Click any beat",
    body: "Selected beats show their crime mix, arrest rate, and hour-of-day pattern in the side panel. Click 'Use this beat for prediction' to ask the ML models.",
    highlight: "side",
  },
  {
    title: "Understand each prediction",
    body: "Every prediction comes with a 'Why?' panel showing SHAP feature contributions — see which inputs pushed the probability up or down.",
    highlight: "side",
  },
];

export default function OnboardingOverlay() {
  // Read localStorage once during initial state; no effect needed.
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === null;
  });
  const [step, setStep] = useState(0);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setVisible(false);
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      dismiss();
    }
  };

  if (!visible) return null;

  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/70 backdrop-blur-sm">
      <div className="max-w-md w-full mx-4 bg-brand-800 border border-brand-700 rounded-xl shadow-2xl p-6 space-y-5">
        {/* Progress dots */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-8 bg-accent-400" : "w-1.5 bg-brand-600"
                }`}
              />
            ))}
          </div>
          <button
            onClick={dismiss}
            className="text-brand-400 hover:text-brand-100 text-sm"
          >
            Skip
          </button>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-brand-50">{current.title}</h2>
          <p className="text-brand-200 text-sm leading-relaxed">{current.body}</p>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="text-sm text-brand-300 hover:text-brand-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Back
          </button>
          <button
            onClick={next}
            className="bg-accent-400 text-brand-900 font-medium rounded px-4 py-2 text-sm
                       hover:bg-accent-300 transition-colors"
          >
            {step < STEPS.length - 1 ? `Next (${step + 1}/${STEPS.length})` : "Got it"}
          </button>
        </div>
      </div>
    </div>
  );
}