import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import methodologyData from "../data/methodology.json";
import FeatureImportanceChart from "../components/charts/FeatureImportanceChart";
import RocCurveChart from "../components/charts/RocCurveChart";

const INTRO = `
# Methodology

CommunityShield is a community-focused public safety platform built on Chicago's open crime data. This page documents the engineering work behind the app: data pipeline, ML models, what worked, what didn't, and the honest limits of what the data can answer.

## What this app does

The app surfaces local crime patterns in Chicago to support resident awareness and community-led prevention work. It is **not** predictive policing. It does not flag individuals, predict who will commit a crime, or recommend enforcement. It is a public-data dashboard with ML-powered situational predictions for selected beats.

## Dataset

- **Source:** City of Chicago crime data, 2001-2026, pulled via Kaggle mirror
- **Total rows ingested:** 8,500,901
- **Rows used for ML:** 2,738,404 (filtered to 2015+ for distribution coherence)
- **Geographic units:** 274 police beats, 77 community areas (PostGIS polygons)

## Why filter to 2015+

Chicago's crime classification rules changed around 2012, and reporting completeness improved over time. Training on pre-2015 data and validating on 2024+ would cross a distribution shift. A 10-year training window matches the realistic horizon for predicting 1-2 years ahead. The 5.8M excluded rows would hurt more than help.

## Temporal split (no leakage)

| Split | Years | Rows |
|-------|-------|------|
| Train | 2015-2023 | 2,219,554 |
| Validation | 2024 | 257,549 |
| Test | 2025-2026 | 261,301 |

Strict year partitioning — no random folds — so the model never sees future data during training. Final metrics are reported on a clean 2025-2026 holdout.
`;

const RESULTS_TABLE = `
## Models trained

Four model architectures were attempted, in order. Each result is real and reproducible.

| Model | Question | Test result |
|-------|----------|-------------|
| Flat 27-class multiclass | What crime type? | 28.4% top-1 acc, 73% top-5 |
| 4-class supercategory | Property / violent / drug / other? | 59.8% acc |
| Property binary (tuned) | Property crime or not? | **68.3% acc, ROC-AUC 0.749** |
| Hierarchical (sup → subtype) | Top-K crime types | 30% top-1, 75% top-5 |
| **Arrest binary** | Will an arrest happen? | **87.9% acc, ROC-AUC 0.859** |
| **Domestic binary** | Is this incident domestic-related? | **86.6% acc, ROC-AUC 0.916** |
`;

const FINDING = `
## The honest finding

Predicting fine-grained crime *type* from these features (time + location) is structurally limited. The dataset describes when and where an incident happened, but the type depends on intent and method — information not in public data. After Optuna hyperparameter search (100 trials, 5-fold time-series CV), feature engineering with location encoding, and architecture variants (flat → binary → hierarchical), all approaches converged on a ~75% top-5 ceiling. The data ceiling is real, not a tuning issue.

Predicting *outcomes* of incidents (arrest, domestic flag) is a different question and works well — those outcomes are causally downstream of features the data contains.
`;

const REST = `
## Feature engineering

- Temporal: hour, day of week, month, weekend flag, quarter, policing shift (day/evening/midnight)
- Spatial: beat number, community area, latitude/longitude, police district (label-encoded)
- Categorical: top-30 location_description grouped into a "location_group" + OTHER bucket (computed from train rows only to avoid leakage)
- For arrest/domestic models: primary_type also included as a feature

The largest single feature gain was adding location_description encoding (+5.5pp accuracy on the property binary model).

## Class imbalance

Most crime types are dominated by THEFT/BATTERY. Using full inverse-frequency class weights collapsed model accuracy. Square-root inverse-frequency weights gave a better balance between recall on rare classes and overall accuracy. SMOTE was deliberately not used: when minority classes lack a separable region in feature space, SMOTE adds noise rather than signal.

## Model selection

For the property-binary problem, four algorithms were compared on identical splits:

| Algorithm | Test accuracy | ROC-AUC | Train time |
|-----------|---------------|---------|------------|
| Logistic Regression | 58.3% | 0.605 | 11s |
| Random Forest | 66.7% | 0.729 | 54s |
| **XGBoost (chosen)** | **67.7%** | **0.741** | 2.2s |
| CatBoost | 66.7% | 0.729 | 16s |

XGBoost won marginally on every metric and trained 25x faster than Random Forest on the same GPU. Optuna tuning (100 trials, time-series CV) added ~0.6pp accuracy and 0.008 ROC-AUC — confirming the model was near the data ceiling.

## Explainability

Each binary model exposes SHAP TreeExplainer values via the API. The frontend's "Why?" panels show the top features pushing each prediction up or down in log-odds space. This is the difference between a black box and a model whose behavior can be inspected per-prediction.

## Architecture

\`\`\`
[ Crime CSV ] -> [ Postgres + PostGIS ] -> [ Rollups table ]
                          |
                          v
              [ FastAPI: predict / heatmap / geo / beats endpoints ]
                          |
                          v
              [ React + MapLibre frontend ]
                          |
                          v
              [ XGBoost models + SHAP explainers ]
\`\`\`

- **Database:** PostgreSQL 16 + PostGIS, with a 7.8M-row pre-aggregated \`beat_rollups\` table (composite index makes heatmap queries ~14ms)
- **Backend:** FastAPI, SQLAlchemy 2.0, Pydantic v2, joblib-loaded XGBoost models
- **Frontend:** Vite + React + TypeScript + Tailwind v3, MapLibre GL JS, CARTO Dark Matter basemap
- **ML:** XGBoost 2.1 (GPU-trained on RTX 4090), Optuna for tuning, SHAP for explainability

## Limitations

- **Not predictive policing.** The models predict beat-level patterns from public data. They do not identify individuals, predict who will commit crimes, or recommend enforcement actions.
- **Reporting bias.** Crime data reflects what was reported and recorded — under-reporting and over-policing of specific neighborhoods are encoded in the inputs.
- **Type prediction is weak.** Use the supercategory or arrest models for decisions, not the 27-class hierarchical prediction.
- **Single-city.** The architecture supports multiple cities, but only Chicago is currently loaded.
- **Static data.** Models are trained on historical data through early 2026 and not retrained automatically.

## Source code

Full source at [github.com/rpmjp/communityshield](https://github.com/rpmjp/communityshield).

Built by Robert Jean Pierre · NJIT CS MS · [robertjeanpierre.com](https://robertjeanpierre.com)
`;


export default function Methodology() {
  const { arrest, domestic, property_binary } = methodologyData;

  return (
    <div className="min-h-screen bg-brand-900 text-brand-50">
      <div className="sticky top-0 z-20 border-b border-brand-700 bg-brand-800/90 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity rounded focus:outline-none focus:ring-2 focus:ring-accent-400">
            <ShieldHeart className="w-6 h-6 text-accent-400" />
            <div>
              <div className="font-bold text-lg leading-tight">CommunityShield</div>
              <div className="text-xs text-brand-300">Methodology</div>
            </div>
          </Link>
          <Link to="/" className="text-sm text-accent-400 hover:text-accent-300 rounded focus:outline-none focus:ring-2 focus:ring-accent-400">
            Back to map
          </Link>
        </div>
      </div>

      <article className="max-w-4xl mx-auto px-6 py-12 space-y-8">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Rows ingested" value="8.5M" />
          <MetricCard label="Police beats" value="274" />
          <MetricCard label="Best AUC" value="0.916" />
          <MetricCard label="Model tasks" value="4" />
        </section>

        <nav className="rounded-lg border border-brand-700 bg-brand-800 px-4 py-3 text-sm">
          <div className="text-xs uppercase tracking-wider text-brand-300 mb-2">
            Review path
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Responsible AI", href: "#responsible-ai" },
              { label: "ROC curves", href: "#roc-curves" },
              { label: "Feature importance", href: "#feature-importance" },
              { label: "Architecture", href: "#architecture" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded border border-brand-700 bg-brand-900 px-2 py-1 text-brand-200 hover:border-accent-400 hover:text-accent-300 focus:outline-none focus:ring-2 focus:ring-accent-400"
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>

        <section id="responsible-ai" className="rounded-lg border border-accent-700 bg-accent-900/30 px-4 py-3 scroll-mt-24">
          <div className="text-xs uppercase tracking-wider text-accent-200">
            Responsible AI boundary
          </div>
          <p className="mt-1 text-sm leading-relaxed text-accent-100/90">
            CommunityShield exposes aggregate, beat-level context from historical public records. It does not predict individuals, recommend enforcement, or replace local review.
          </p>
        </section>

        <div className="prose prose-invert prose-cs max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{INTRO}</ReactMarkdown>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{RESULTS_TABLE}</ReactMarkdown>
        </div>

        {/* ROC curves */}
        <section id="roc-curves" className="space-y-3 scroll-mt-24">
          <h2 className="text-2xl font-bold text-brand-50">ROC curves</h2>
          <p className="text-brand-200 text-sm">
            Each curve plots true positive rate vs false positive rate as the decision
            threshold sweeps from 1 to 0. The dashed line is random-chance baseline.
            Area under the curve (AUC) is a threshold-independent measure of how well
            the model separates classes.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <RocCurveChart
              title="Arrest"
              data={arrest.roc}
              auc={arrest.metrics.test?.roc_auc ?? 0}
              color="#E8A04C"
            />
            <RocCurveChart
              title="Domestic"
              data={domestic.roc}
              auc={domestic.metrics.test?.roc_auc ?? 0}
              color="#76A593"
            />
            <RocCurveChart
              title="Property crime (binary)"
              data={property_binary.roc}
              auc={property_binary.metrics.test?.roc_auc ?? 0}
              color="#EAAC55"
            />
          </div>
        </section>

        {/* Feature importance */}
        <section id="feature-importance" className="space-y-3 scroll-mt-24">
          <h2 className="text-2xl font-bold text-brand-50">Feature importance</h2>
          <p className="text-brand-200 text-sm">
            XGBoost gain — the total gain (loss reduction) attributable to splits on each
            feature, summed across the boosted ensemble. Higher means the model relies on
            that feature more.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <FeatureImportanceChart
              title="Arrest model"
              data={arrest.feature_importance}
              color="#E8A04C"
            />
            <FeatureImportanceChart
              title="Domestic model"
              data={domestic.feature_importance}
              color="#76A593"
            />
            <FeatureImportanceChart
              title="Property crime model"
              data={property_binary.feature_importance}
              color="#EAAC55"
            />
          </div>
        </section>

        <div className="prose prose-invert prose-cs max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{FINDING}</ReactMarkdown>
          <div id="architecture" className="scroll-mt-24" />
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{REST}</ReactMarkdown>
        </div>
      </article>

      <div className="border-t border-brand-700 py-8 text-center text-xs text-brand-400">
        Built with care · open source · no ads · no tracking
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-brand-700 bg-brand-800 p-4">
      <div className="text-2xl font-semibold text-accent-300">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wider text-brand-300">{label}</div>
    </div>
  );
}


function ShieldHeart({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M24 4 L42 10 V24 C42 34 33 42 24 44 C15 42 6 34 6 24 V10 Z"
            fill="currentColor" opacity="0.18" stroke="currentColor" strokeWidth="2" />
      <path d="M24 33 C24 33 14 27 14 20 C14 16.5 16.5 14 20 14 C22 14 23.5 15 24 16.5 C24.5 15 26 14 28 14 C31.5 14 34 16.5 34 20 C34 27 24 33 24 33 Z"
            fill="currentColor" />
    </svg>
  );
}
