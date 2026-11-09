import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaffAdmin } from "@/lib/auth/context";
import {
  listTelegramPublications,
  TELEGRAM_STATES,
} from "@/lib/admin/telegram";
import AdminNav from "../nav";
import {
  retryAllTelegramPublicationsAction,
  retryTelegramPublicationAction,
} from "./actions";

export const metadata = {
  title: "Telegram Publications | JobEthiopia Admin",
};

const ERROR_MESSAGES: Record<string, string> = {
  csrf: "The request could not be verified. Please try again.",
  invalid: "Invalid publication id.",
  notfound: "Publication not found.",
  notretryable: "Only failed or skipped publications can be retried.",
};

export default async function AdminTelegramPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    state?: string;
    retried?: string;
    requeued?: string;
    error?: string;
  }>;
}) {
  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin");
  }

  const params = await searchParams;
  const page = Number.parseInt(params.page ?? "1", 10);
  const state =
    params.state && (TELEGRAM_STATES as readonly string[]).includes(params.state)
      ? params.state
      : undefined;

  let result;
  let loadError = false;
  try {
    result = await listTelegramPublications({ page, limit: 25, state });
  } catch {
    loadError = true;
  }

  const errorMessage = params.error ? ERROR_MESSAGES[params.error] : null;

  return (
    <div>
      <AdminNav />
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-foreground">
          Telegram Publications
        </h1>
        <p className="mt-2 text-sm text-muted">
          Durable outbox for automatically published jobs. Failed and skipped
          entries can be requeued; sent entries are never retried.
        </p>

        {params.retried && (
          <p className="mt-4 rounded-lg border border-success bg-success-light px-4 py-2 text-sm text-success">
            Publication requeued.
          </p>
        )}
        {params.requeued && (
          <p className="mt-4 rounded-lg border border-success bg-success-light px-4 py-2 text-sm text-success">
            {params.requeued} publication(s) requeued.
          </p>
        )}
        {errorMessage && (
          <p role="alert" className="mt-4 rounded-lg border border-destructive bg-destructive-light px-4 py-2 text-sm text-destructive">
            {errorMessage}
          </p>
        )}

        {loadError ? (
          <p className="mt-4 text-sm text-destructive">
            We could not load Telegram publications right now. Please try again
            shortly.
          </p>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/admin/telegram"
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  !state
                    ? "bg-primary text-white shadow-sm"
                    : "border border-border bg-surface text-muted hover:bg-surface-raised hover:text-foreground"
                }`}
              >
                All
              </Link>
              {TELEGRAM_STATES.map((value) => (
                <Link
                  key={value}
                  href={`/admin/telegram?state=${value}`}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    state === value
                      ? "bg-primary text-white shadow-sm"
                      : "border border-border bg-surface text-muted hover:bg-surface-raised hover:text-foreground"
                  }`}
                >
                  {value} ({result!.counts[value] ?? 0})
                </Link>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <form action={retryAllTelegramPublicationsAction}>
                <button
                  type="submit"
                  className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-surface-raised"
                >
                  Retry all failed/skipped
                </button>
              </form>
            </div>

            {result!.items.length === 0 ? (
              <p className="mt-6 text-sm text-subtle">
                No Telegram publications found.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {result!.items.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-border bg-surface p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <Link
                          href={`/jobs/${item.jobId}`}
                          className="font-semibold text-foreground hover:text-primary"
                        >
                          {item.jobTitle ?? item.jobId}
                        </Link>
                        <div className="mt-1 text-sm text-muted">
                          Job status: {item.jobStatus ?? "missing"} | Channel:{" "}
                          {item.channel}
                        </div>
                      </div>
                      <span className="rounded-full border border-border-subtle bg-surface-raised px-2.5 py-0.5 text-xs font-semibold text-muted">
                        {item.state}
                      </span>
                    </div>

                    <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                      <div>
                        <dt className="text-muted">Attempts</dt>
                        <dd className="font-medium text-foreground">
                          {item.attempts}/{item.maxAttempts}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted">Next retry</dt>
                        <dd className="font-medium text-foreground">
                          {item.nextRetryAt
                            ? new Date(item.nextRetryAt).toLocaleString()
                            : "None"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted">Sent</dt>
                        <dd className="font-medium text-foreground">
                          {item.sentAt
                            ? new Date(item.sentAt).toLocaleString()
                            : "Not sent"}
                        </dd>
                      </div>
                    </dl>

                    {item.lastError && (
                      <p className="mt-2 text-sm text-destructive">
                        {item.lastError}
                      </p>
                    )}

                    {(item.state === "FAILED" || item.state === "SKIPPED") && (
                      <form
                        action={retryTelegramPublicationAction}
                        className="mt-3"
                      >
                        <input
                          type="hidden"
                          name="publicationId"
                          value={item.id}
                        />
                        <button
                          type="submit"
                          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover"
                        >
                          Requeue
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {result!.totalPages > 1 && (
              <nav className="mt-4 flex items-center justify-between">
                <div className="flex gap-1">
                  {result!.page > 1 && (
                    <Link
                      href={`/admin/telegram?page=${result!.page - 1}${state ? `&state=${state}` : ""}`}
                      className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-muted hover:bg-surface-raised hover:text-foreground"
                    >
                      Previous
                    </Link>
                  )}
                </div>
                <span className="text-sm text-muted">
                  Page {result!.page} of {result!.totalPages}
                </span>
                <div className="flex gap-1">
                  {result!.page < result!.totalPages && (
                    <Link
                      href={`/admin/telegram?page=${result!.page + 1}${state ? `&state=${state}` : ""}`}
                      className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-muted hover:bg-surface-raised hover:text-foreground"
                    >
                      Next
                    </Link>
                  )}
                </div>
              </nav>
            )}
          </>
        )}
      </main>
    </div>
  );
}
