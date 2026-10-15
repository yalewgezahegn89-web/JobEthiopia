import Link from "next/link";
import type { Messages } from "@/lib/i18n/dictionary";
import type { CvReadinessCheckKey } from "@/lib/cv/completeness";

type CvReadinessCardProps = {
  t: Messages;
  percent: number;
  complete: boolean;
  missing: CvReadinessCheckKey[];
  hasCv: boolean;
};

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/**
 * CV readiness scorecard (Phase 13 — Career Tools).
 *
 * Displays the deterministic 0-100 readiness score computed by
 * evaluateCvReadiness and the concrete missing sections, with a single
 * action pointing back to the CV editor. Purely presentational — no state.
 */
export function CvReadinessCard({
  t,
  percent,
  complete,
  missing,
  hasCv,
}: CvReadinessCardProps) {
  const r = t.cv.readiness;

  return (
    <section
      aria-label={r.heading}
      className="rounded-xl border border-border bg-surface p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">{r.heading}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">{r.subtitle}</p>
        </div>
        <span className="rounded-full bg-primary-light px-4 py-1.5 text-lg font-bold text-primary">
          {percent}%
        </span>
      </div>

      <div
        className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-raised"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={r.heading}
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      {complete ? (
        <p className="mt-4 text-sm font-semibold text-success">
          <CheckIcon className="mr-1 inline h-4 w-4" />
          {r.complete}
          <span className="ml-2 font-normal text-muted">{r.completeHint}</span>
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm font-semibold text-foreground">
            {r.missingHeading}
          </p>
          <ul className="mt-2 space-y-1.5">
            {missing.map((key) => (
              <li key={key} className="flex items-center gap-2 text-sm text-muted">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-destructive"
                  aria-hidden="true"
                />
                {r.checkLabels[key]}
              </li>
            ))}
          </ul>
          <Link
            href="/cv/edit"
            className="focus-visible:outline-2 mt-5 inline-flex items-center justify-center rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-raised focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {hasCv ? r.ctaEdit : r.ctaCreate}
          </Link>
        </>
      )}
    </section>
  );
}