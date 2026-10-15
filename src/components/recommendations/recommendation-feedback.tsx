"use client";

import { useState, useTransition } from "react";
import type { Dictionary } from "@/lib/i18n/dictionary";

type FeedbackType = "relevant" | "not_relevant" | "hidden";

export function RecommendationFeedback({
  jobId,
  t,
}: {
  jobId: string;
  t: Dictionary;
}) {
  const [feedback, setFeedback] = useState<FeedbackType | null>(null);
  const [pending, startTransition] = useTransition();

  function submitFeedback(type: FeedbackType) {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/recommendations/${jobId}/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feedback: type }),
        });
        if (res.ok) {
          setFeedback(type);
        }
      } catch {
        // Best-effort: silent failure
      }
    });
  }

  if (feedback) {
    return (
      <span className="text-xs text-muted italic">
        {feedback === "hidden" ? t.recommendations.feedbackHidden : t.recommendations.feedbackThankYou}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => submitFeedback("relevant")}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-muted transition-colors hover:border-green-300 hover:text-green-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
        aria-label={t.recommendations.feedbackRelevant}
      >
        <span aria-hidden="true">&#x1F44D;</span>
      </button>
      <button
        type="button"
        onClick={() => submitFeedback("not_relevant")}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-muted transition-colors hover:border-red-300 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
        aria-label={t.recommendations.feedbackNotRelevant}
      >
        <span aria-hidden="true">&#x1F44E;</span>
      </button>
      <button
        type="button"
        onClick={() => submitFeedback("hidden")}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-muted transition-colors hover:border-orange-300 hover:text-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
        aria-label={t.recommendations.feedbackHide}
      >
        <span aria-hidden="true">&#x1F6AB;</span>
      </button>
    </div>
  );
}
