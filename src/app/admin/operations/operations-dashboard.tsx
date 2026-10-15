"use client";

import type {
  OperationsSummary,
  MaintenanceRunSummary,
  IngestionBatchSummary,
  FailingSource,
} from "@/lib/admin/operations";

function formatTimestamp(ts: string | null): string {
  if (!ts) return "Never";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function Duration({ ms }: { ms: number | null }) {
  if (ms === null) return null;
  return <span className="text-subtle"> ({ms}ms)</span>;
}

function MaintenanceSection({
  latest,
  recent,
}: {
  latest: MaintenanceRunSummary | null;
  recent: MaintenanceRunSummary[];
}) {
  return (
    <section className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">Maintenance</h2>
      {latest ? (
        <div className="mt-3">
          <div className="text-sm text-muted">
            Last run: {formatTimestamp(latest.timestamp)}
            <Duration ms={latest.durationMs} />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted">Expired jobs</dt>
              <dd className="font-medium text-foreground">{latest.expiredJobs}</dd>
            </div>
            <div>
              <dt className="text-muted">Sources checked</dt>
              <dd className="font-medium text-foreground">{latest.sourcesChecked}</dd>
            </div>
            <div>
              <dt className="text-muted">Succeeded</dt>
              <dd className="font-medium text-success">{latest.sourcesSucceeded}</dd>
            </div>
            <div>
              <dt className="text-muted">Failed</dt>
              <dd
                className={`font-medium ${
                  latest.sourcesFailed > 0 ? "text-destructive" : "text-success"
                }`}
              >
                {latest.sourcesFailed}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Skipped</dt>
              <dd className="font-medium text-foreground">{latest.sourcesSkipped}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">No maintenance runs recorded.</p>
      )}
      {recent.length > 1 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-muted hover:text-foreground">
            Recent history ({recent.length} runs)
          </summary>
          <div className="mt-2 space-y-2">
            {recent.map((run, i) => (
              <div
                key={`${run.timestamp}-${i}`}
                className="rounded-lg border border-border-subtle bg-surface-raised p-3 text-sm"
              >
                <div className="text-muted">
                  {formatTimestamp(run.timestamp)}
                  <Duration ms={run.durationMs} />
                </div>
                <div className="text-foreground">
                  Expired: {run.expiredJobs} | Checked: {run.sourcesChecked} |
                  Failed: {run.sourcesFailed}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function IngestionSection({
  latest,
  recent,
}: {
  latest: IngestionBatchSummary | null;
  recent: IngestionBatchSummary[];
}) {
  return (
    <section className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">Ingestion</h2>
      {latest ? (
        <div className="mt-3">
          <div className="text-sm text-muted">
            Last batch: {formatTimestamp(latest.timestamp)}
            <Duration ms={latest.durationMs} />
          </div>
          {latest.sourceName && (
            <div className="mt-1 text-sm text-foreground">Source: {latest.sourceName}</div>
          )}
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted">Created</dt>
              <dd className="font-medium text-success">{latest.created}</dd>
            </div>
            <div>
              <dt className="text-muted">Updated</dt>
              <dd className="font-medium text-foreground">{latest.updated}</dd>
            </div>
            <div>
              <dt className="text-muted">Duplicate</dt>
              <dd className="font-medium text-foreground">{latest.duplicate}</dd>
            </div>
            <div>
              <dt className="text-muted">Failed</dt>
              <dd
                className={`font-medium ${
                  latest.failed > 0 ? "text-destructive" : "text-success"
                }`}
              >
                {latest.failed}
              </dd>
            </div>
            {latest.linked !== null && (
              <div>
                <dt className="text-muted">Linked</dt>
                <dd className="font-medium text-foreground">{latest.linked}</dd>
              </div>
            )}
            {latest.possibleDuplicate !== null && (
              <div>
                <dt className="text-muted">Possible dupes</dt>
                <dd className="font-medium text-foreground">{latest.possibleDuplicate}</dd>
              </div>
            )}
            {latest.total !== null && (
              <div>
                <dt className="text-muted">Total</dt>
                <dd className="font-medium text-foreground">{latest.total}</dd>
              </div>
            )}
          </dl>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">No ingestion batches recorded.</p>
      )}
      {recent.length > 1 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-muted hover:text-foreground">
            Recent history ({recent.length} batches)
          </summary>
          <div className="mt-2 space-y-2">
            {recent.map((batch, i) => (
              <div
                key={`${batch.timestamp}-${i}`}
                className="rounded-lg border border-border-subtle bg-surface-raised p-3 text-sm"
              >
                <div className="text-muted">
                  {formatTimestamp(batch.timestamp)}
                  <Duration ms={batch.durationMs} />
                  {batch.sourceName && ` — ${batch.sourceName}`}
                </div>
                <div className="text-foreground">
                  Created: {batch.created} | Updated: {batch.updated} |
                  Duplicate: {batch.duplicate} | Failed: {batch.failed}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function FailingSourcesSection({ sources }: { sources: FailingSource[] }) {
  return (
    <section className="mt-6 rounded-xl border border-destructive/20 bg-destructive-light p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">Failing Sources</h2>
      {sources.length > 0 ? (
        <div className="mt-3 space-y-2">
          {sources.map((source) => (
            <div
              key={source.id}
              className="rounded-lg border border-destructive/20 bg-surface p-4 text-sm"
            >
              <div className="font-semibold text-foreground">{source.name}</div>
              <div className="mt-1 text-destructive">
                Consecutive failures: {source.consecutiveFailures}
              </div>
              {source.lastError && (
                <div className="mt-1 text-muted">Error: {source.lastError}</div>
              )}
              <div className="mt-1 text-muted">
                Last attempted: {formatTimestamp(source.lastAttemptedCheck)}
              </div>
              {source.lastSuccessfulCheck && (
                <div className="text-muted">
                  Last success: {formatTimestamp(source.lastSuccessfulCheck)}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">No failing sources.</p>
      )}
    </section>
  );
}

export default function OperationsDashboard({
  summary,
}: {
  summary: OperationsSummary;
}) {
  return (
    <div>
      <MaintenanceSection
        latest={summary.latestMaintenance}
        recent={summary.recentMaintenance}
      />
      <IngestionSection
        latest={summary.latestIngestion}
        recent={summary.recentIngestion}
      />
      <FailingSourcesSection sources={summary.failingSources} />
    </div>
  );
}
