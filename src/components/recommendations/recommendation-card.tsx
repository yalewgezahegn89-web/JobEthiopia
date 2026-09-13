/**
 * Recommendation card for the candidate recommendations page.
 *
 * Composes the shared `JobCard` with a match-score header, an expandable
 * "why it matches" list built from the pure factor details, and a feedback
 * sub-component. Pure, server-safe; no client scripts except the feedback
 * client component. The reasons helper is exported for direct testing.
 */
import JobCard from "@/components/job-card";
import { RecommendationFeedback } from "./recommendation-feedback";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { RecommendationItem } from "@/lib/matching/dal";
import type { MatchFactor } from "@/lib/matching/types";

export type { RecommendationItem };

/**
 * Builds the localized "why it matches" copy from factor details. Only
 * positive, meaningful factors produce a reason; neutral/missing data does not.
 */
export function buildRecommendationReasons(
  factors: MatchFactor[],
  t: Dictionary,
): string[] {
  const reasons: string[] = [];
  for (const factor of factors) {
    if (factor.score <= 0) continue;
    const detail = factor.detail;
    switch (factor.key) {
      case "professionAndCategory":
        reasons.push(
          detail.reason === "profession"
            ? t.recommendations.reasonProfession
            : t.recommendations.reasonCategory,
        );
        break;
      case "location":
        if (detail.reason === "exact") {
          reasons.push(t.recommendations.reasonLocationExact);
        } else if (
          detail.reason === "same-parent" ||
          detail.reason === "nested"
        ) {
          reasons.push(t.recommendations.reasonLocationSameRegion);
        }
        break;
      case "experience":
        if (detail.reason === "matched") {
          reasons.push(t.recommendations.reasonExperienceMatch);
        } else if (detail.reason === "close") {
          reasons.push(t.recommendations.reasonExperienceClose);
        } else if (detail.reason === "none-required") {
          reasons.push(t.recommendations.reasonExperienceOpen);
        }
        break;
      case "employmentType":
        if (detail.reason === "matched") {
          reasons.push(t.recommendations.reasonEmployment);
        }
        break;
      case "skills": {
        const matchedCount = typeof detail.matchedCount === "number" ? detail.matchedCount : 0;
        if (matchedCount === 0) break;

        // Structured skill explanation (required + preferred breakdown)
        if (
          detail.reason === "structured-required" ||
          detail.reason === "structured-preferred"
        ) {
          const totalRequired = typeof detail.totalRequired === "number" ? detail.totalRequired : 0;
          const matchedRequired = typeof detail.matchedRequired === "number" ? detail.matchedRequired : 0;
          const totalPreferred = typeof detail.totalPreferred === "number" ? detail.totalPreferred : 0;
          const matchedPreferred = typeof detail.matchedPreferred === "number" ? detail.matchedPreferred : 0;

          if (totalRequired > 0) {
            reasons.push(t.recommendations.reasonSkillsRequired(matchedRequired, totalRequired));
          }
          if (totalPreferred > 0 && matchedPreferred > 0) {
            reasons.push(t.recommendations.reasonSkillsPreferred(matchedPreferred));
          }
        } else {
          // Fallback text-based explanation
          reasons.push(t.recommendations.reasonSkills(matchedCount));
        }
        break;
      }
      case "freshness":
        if (detail.reason === "recent") {
          reasons.push(t.recommendations.reasonFreshness);
        }
        break;
    }
  }
  return reasons;
}

export function scorePercent(score: number): number {
  return Math.round(Math.min(1, Math.max(0, score)) * 100);
}

export default function RecommendationCard({
  item,
  t,
}: {
  item: RecommendationItem;
  t: Dictionary;
}) {
  const reasons = buildRecommendationReasons(item.factors, t);
  const percent = scorePercent(item.score);

  return (
    <section
      data-testid="recommendation-card"
      className="rounded-xl border border-border bg-surface p-4 shadow-sm"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-primary-light px-3 py-1 text-xs font-bold text-primary"
          data-testid="match-score"
        >
          {t.recommendations.scoreLabel(percent)}
        </span>
        {reasons.length > 0 && (
          <details className="group text-sm text-muted">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-full border border-border bg-surface-raised px-3 py-1 font-semibold text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              {t.recommendations.whyMatches}
            </summary>
            <ul data-testid="match-reasons" className="mt-2 space-y-1 rounded-lg border border-border-subtle bg-surface-raised px-3 py-2">
              {reasons.map((reason, index) => (
                <li key={index} className="text-xs leading-5 text-muted">
                  {reason}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
      <JobCard job={item.job} t={t} />
      <div className="mt-3 flex justify-end">
        <RecommendationFeedback jobId={item.job.id} t={t} />
      </div>
    </section>
  );
}

export { RecommendationCard };