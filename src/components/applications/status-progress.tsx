import type { ApplicationStatus } from "@/lib/applications/dal";
import { APPLICATION_STATUS_META, getStatusLabel } from "@/components/applications/status-badge";
import { CheckIcon } from "@/components/public/icons";

const PROGRESS_STEPS: ApplicationStatus[] = [
  "SUBMITTED",
  "REVIEWING",
  "SHORTLISTED",
];

function XIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  );
}

function MinusIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8" />
    </svg>
  );
}

export function ApplicationStatusProgress({
  status,
  t,
}: {
  status: ApplicationStatus;
  t?: (key: string) => string;
}) {
  const meta = APPLICATION_STATUS_META[status];
  const description = t
    ? t(`applications.status.description${status.charAt(0)}${status.slice(1).toLowerCase()}`)
    : meta.description;

  if (meta.tone === "terminal") {
    return (
      <div
        role="status"
        className="flex items-start gap-4 rounded-xl border border-border bg-surface px-5 py-4"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-raised text-muted">
          {status === "REJECTED" ? (
            <XIcon className="h-4 w-4" />
          ) : (
            <MinusIcon className="h-4 w-4" />
          )}
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">
              {getStatusLabel(status, t)}
            </p>
          </div>
          <p className="mt-1 text-sm leading-6 text-muted">
            {description}
          </p>
        </div>
      </div>
    );
  }

  const activeIndex = PROGRESS_STEPS.indexOf(status);

  return (
    <div className="rounded-xl border border-border bg-surface px-5 py-5">
      <p className="text-sm leading-6 text-muted">{description}</p>
      <ol className="mt-4 flex items-start" aria-label={t ? t("applications.status.heading") : "Application progress"}>
        {PROGRESS_STEPS.map((step, index) => {
          const isDone = index < activeIndex;
          const isCurrent = index === activeIndex;
          return (
            <li key={step} className="flex flex-1 items-start">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  isDone
                    ? "bg-primary text-white"
                    : isCurrent
                      ? "border-2 border-primary bg-surface text-primary"
                      : "bg-surface-raised text-subtle"
                }`}
                aria-current={isCurrent ? "step" : undefined}
              >
                {isDone ? (
                  <CheckIcon className="h-3.5 w-3.5" />
                ) : (
                  index + 1
                )}
                {isCurrent && (
                  <span className="sr-only">
                    {t ? t("applications.status.currentStep") : "Current step"}
                  </span>
                )}
              </span>
              <span className="mt-1 ml-2">
                <span
                  className={`block text-xs font-semibold ${
                    isDone || isCurrent
                      ? "text-foreground"
                      : "text-subtle"
                  }`}
                >
                  {getStatusLabel(step, t)}
                </span>
              </span>
              {index < PROGRESS_STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`mx-2 mt-3.5 h-0.5 flex-1 rounded-full ${
                    index < activeIndex ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
