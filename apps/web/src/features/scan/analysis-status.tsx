"use client";

import type { SaleView } from "@yard/contracts";

import { getScanPresentation } from "./presentation";

type AnalysisStatusProps = {
  sale: Pick<
    SaleView,
    "status" | "processingStage" | "progress" | "items" | "error"
  >;
  retrying: boolean;
  onRetry: () => void;
};

const steps = ["Photo ready", "Find items", "Make cutouts"] as const;

export function AnalysisStatus({ sale, retrying, onRetry }: AnalysisStatusProps) {
  const presentation = getScanPresentation(sale);

  return (
    <section className="analysis-status-card" aria-live="polite">
      <div className="analysis-status-heading" key={sale.processingStage}>
        <div className="analysis-status-meta">
          <span className="label">{presentation.eyebrow}</span>
          <span className="analysis-progress-number">{presentation.progress}%</span>
        </div>
        <h1>{presentation.title}</h1>
        <p>{presentation.detail}</p>
      </div>

      <div
        className="analysis-progress-track"
        role="progressbar"
        aria-label="Analysis progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={presentation.progress}
      >
        <span style={{ width: `${presentation.progress}%` }} />
      </div>

      <ol className="analysis-steps" aria-label="Analysis stages">
        {steps.map((step, index) => {
          const done = presentation.activeStep > index;
          const active = presentation.activeStep === index && !presentation.failed;
          return (
            <li key={step} data-done={done} data-active={active}>
              <span className="analysis-step-icon" aria-hidden="true">
                {done ? "✓" : active ? <span className="live-dot" /> : index + 1}
              </span>
              <span>{step}</span>
            </li>
          );
        })}
      </ol>

      {presentation.failed ? (
        <button
          type="button"
          className="btn analysis-retry"
          onClick={onRetry}
          disabled={retrying}
        >
          {retrying ? "Trying again…" : "Try analysis again"}
        </button>
      ) : presentation.foundCount > 0 ? (
        <span className="analysis-found-count">
          {presentation.foundCount} potential item
          {presentation.foundCount === 1 ? "" : "s"} found
        </span>
      ) : null}
    </section>
  );
}
