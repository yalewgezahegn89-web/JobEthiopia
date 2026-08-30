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
  return <span className="text-neutral-500"> ({ms}ms)</span>;
}

function MaintenanceSection({
  latest,
  recent,
}: {
  latest: MaintenanceRunSummary | null;
  recent: MaintenanceRunSummary[];
}) {
  return (
    <section className="mt-6">
      <h2 className="text-lg font-medium">Maintenance</h2>
      {latest ? (
        <div className="mt-2 rounded border border-neutral-200 p-4">
          <div className="text-sm text-neutral-500">
            Last run: {formatTimestamp(latest.timestamp)}
            <Duration ms={latest.durationMs} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div>
              Expired jobs: <span className="font-medium">{latest.expiredJobs}</span>
            </div>
            <div>
              Sources checked:{" "}
              <span className="font-medium">{latest.sourcesChecked}</span>
            </div>
            <div>
              Succeeded:{" "}
              <span className="font-medium text-green-700">
                {latest.sourcesSucceeded}
              </span>
            </div>
            <div>
              Failed:{" "}
              <span
                className={`font-medium ${
                  latest.sourcesFailed > 0 ? "text-red-600" : "text-green-700"
                }`}
              >
                {latest.sourcesFailed}
              </span>
            </div>
            <div>
              Skipped: <span className="font-medium">{latest.sourcesSkipped}</span>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-neutral-500">No maintenance runs recorded.</p>
      )}
      {recent.length > 1 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-neutral-500 hover:text-neutral-700">
            Recent history ({recent.length} runs)
          </summary>
          <div className="mt-2 space-y-2">
            {recent.map((run, i) => (
              <div
                key={`${run.timestamp}-${i}`}
                className="rounded border border-neutral-100 p-3 text-sm"
              >
                <div className="text-neutral-500">
                  {formatTimestamp(run.timestamp)}
                  <Duration ms={run.durationMs} />
                </div>
                <div>
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
    <section className="mt-6">
      <h2 className="text-lg font-medium">Ingestion</h2>
      {latest ? (
        <div className="mt-2 rounded border border-neutral-200 p-4">
          <div className="text-sm text-neutral-500">
            Last batch: {formatTimestamp(latest.timestamp)}
            <Duration ms={latest.durationMs} />
          </div>
          {latest.sourceName && (
            <div className="mt-1 text-sm">Source: {latest.sourceName}</div>
          )}
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div>
              Created: <span className="font-medium text-green-700">{latest.created}</span>
            </div>
            <div>
              Updated: <span className="font-medium">{latest.updated}</span>
            </div>
            <div>
              Duplicate: <span className="font-medium">{latest.duplicate}</span>
            </div>
            <div>
              Failed:{" "}
              <span
                className={`font-medium ${
                  latest.failed > 0 ? "text-red-600" : "text-green-700"
                }`}
              >
                {latest.failed}
              </span>
            </div>
            {latest.linked !== null && (
              <div>
                Linked: <span className="font-medium">{latest.linked}</span>
              </div>
            )}
            {latest.possibleDuplicate !== null && (
              <div>
                Possible dupes:{" "}
                <span className="font-medium">{latest.possibleDuplicate}</span>
              </div>
            )}
            {latest.total !== null && (
              <div>
                Total: <span className="font-medium">{latest.total}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-neutral-500">
          No ingestion batches recorded.
        </p>
      )}
      {recent.length > 1 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-neutral-500 hover:text-neutral-700">
            Recent history ({recent.length} batches)
          </summary>
          <div className="mt-2 space-y-2">
            {recent.map((batch, i) => (
              <div
                key={`${batch.timestamp}-${i}`}
                className="rounded border border-neutral-100 p-3 text-sm"
              >
                <div className="text-neutral-500">
                  {formatTimestamp(batch.timestamp)}
                  <Duration ms={batch.durationMs} />
                  {batch.sourceName && ` — ${batch.sourceName}`}
                </div>
                <div>
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
    <section className="mt-6">
      <h2 className="text-lg font-medium">Failing Sources</h2>
      {sources.length > 0 ? (
        <div className="mt-2 space-y-2">
          {sources.map((source) => (
            <div
              key={source.id}
              className="rounded border border-red-200 bg-red-50 p-3 text-sm"
            >
              <div className="font-medium">{source.name}</div>
              <div className="mt-1 text-red-600">
                Consecutive failures: {source.consecutiveFailures}
              </div>
              {source.lastError && (
                <div className="mt-1 text-neutral-600">
                  Error: {source.lastError}
                </div>
              )}
              <div className="mt-1 text-neutral-500">
                Last attempted: {formatTimestamp(source.lastAttemptedCheck)}
              </div>
              {source.lastSuccessfulCheck && (
                <div className="text-neutral-500">
                  Last success: {formatTimestamp(source.lastSuccessfulCheck)}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-neutral-500">No failing sources.</p>
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
