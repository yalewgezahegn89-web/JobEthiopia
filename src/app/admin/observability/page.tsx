import { redirect } from "next/navigation";
import { requireStaffAdmin } from "@/lib/auth/context";
import {
  getObservabilitySummary,
  type Indicator,
  type IndicatorState,
} from "@/lib/admin/observability";
import AdminNav from "../nav";

export const metadata = {
  title: "Observability | JobEthiopia Admin",
};

const STATE_STYLES: Record<IndicatorState, string> = {
  ok: "text-success",
  warn: "text-warning",
  critical: "text-destructive",
  unknown: "text-muted",
};

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 rounded-xl border border-border bg-surface p-4">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-xs text-muted">{description}</p>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
        {children}
      </dl>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-xs font-medium tabular-nums text-foreground">
        {value}
      </dd>
    </div>
  );
}

function IndicatorCard({ indicator }: { indicator: Indicator }) {
  return (
    <div className="rounded-lg border border-border bg-surface-raised p-3">
      <p className="text-xs text-muted">{indicator.label}</p>
      <p
        className={`mt-1 text-lg font-semibold tabular-nums ${STATE_STYLES[indicator.state]}`}
      >
        {indicator.value}
      </p>
      <p className="mt-1 text-[11px] text-muted">{indicator.threshold}</p>
    </div>
  );
}

export default async function AdminObservabilityPage() {
  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin");
  }

  const summary = getObservabilitySummary();
  const { request, database, ingestion, rateLimit, cache, internalFetch } =
    summary;

  const recentRuns = ingestion.history.slice(0, 10);

  return (
    <div>
      <AdminNav />
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Observability
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          {summary.scopeNote}
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {summary.indicators.map((indicator) => (
            <IndicatorCard key={indicator.key} indicator={indicator} />
          ))}
        </div>

        <Section
          title="Request health"
          description="API requests measured at the route handler: volume, status classes and latency."
        >
          <Row label="Requests observed" value={String(request.total)} />
          <Row label="Distinct route × method series" value={String(request.series)} />
          <Row
            label="Status classes"
            value={`2xx ${request.statusClasses["2xx"]} · 3xx ${request.statusClasses["3xx"]} · 4xx ${request.statusClasses["4xx"]} · 5xx ${request.statusClasses["5xx"]}`}
          />
          <Row
            label="Latency (avg / p50 / p95 / p99)"
            value={`${request.avgMs} / ${request.p50Ms} / ${request.p95Ms} / ${request.p99Ms} ms`}
          />
          <Row
            label="Slowest observed (max)"
            value={`${request.routes.reduce((max, r) => Math.max(max, r.maxMs), 0)} ms`}
          />
          <Row
            label="Route series overflow"
            value={request.overflow ? "yes (bounded at 200 series)" : "no"}
          />
        </Section>

        <Section
          title="Database"
          description="Pool counters and readiness-probe results. Connection details are never published."
        >
          <Row
            label="Connections (active / idle / waiting)"
            value={
              database.pool
                ? `${database.pool.active} / ${database.pool.idle} / ${database.pool.waiting}`
                : "pool unavailable"
            }
          />
          <Row
            label="Pool size (active / max)"
            value={
              database.pool
                ? `${database.pool.active} / ${database.pool.max}`
                : "pool unavailable"
            }
          />
          <Row
            label="Utilisation"
            value={
              database.pool && database.pool.utilisationPercent !== null
                ? `${database.pool.utilisationPercent} %`
                : "unknown"
            }
          />
          <Row
            label="Readiness probes (ok / total)"
            value={`${database.probe.checks - database.probe.failures} / ${database.probe.checks}`}
          />
          <Row
            label="Last probe"
            value={
              database.probe.lastOk === null
                ? "not measured yet"
                : `${database.probe.lastOk ? "ok" : "failed"} in ${database.probe.lastDurationMs} ms`
            }
          />
          <Row
            label="Probe latency (avg / max)"
            value={`${database.probe.avgDurationMs} / ${database.probe.maxDurationMs} ms`}
          />
        </Section>

        <Section
          title="Ingestion"
          description="Automated source ingestion runs recorded in the bounded in-process ring."
        >
          <Row label="Runs recorded" value={String(ingestion.runs)} />
          <Row
            label="Succeeded / failed"
            value={`${ingestion.succeeded} / ${ingestion.failed}`}
          />
          <Row
            label="Last run"
            value={
              ingestion.lastRun
                ? `${ingestion.lastRun.status} · ${ingestion.lastRun.durationMs} ms · ${ingestion.lastRun.sourcesAttempted} sources`
                : "no runs recorded"
            }
          />
          <Row
            label="Last run job counts"
            value={
              ingestion.lastRun
                ? `received ${ingestion.lastRun.jobsReceived} · created ${ingestion.lastRun.jobsCreated} · updated ${ingestion.lastRun.jobsUpdated} · duplicates ${ingestion.lastRun.duplicates} · failed ${ingestion.lastRun.failedRecords}`
                : "—"
            }
          />
          <Row
            label="Auto-deactivated sources (last run)"
            value={
              ingestion.lastRun
                ? String(ingestion.lastRun.autoDeactivatedSources)
                : "—"
            }
          />
          <Row label="Recent runs retained" value={String(recentRuns.length)} />
        </Section>

        <Section
          title="Rate limiting"
          description="Requests rejected by the middleware rate limiter, grouped by bucket."
        >
          <Row label="Total rejections" value={String(rateLimit.rejections)} />
          <Row
            label="Buckets with rejections"
            value={String(rateLimit.buckets.length)}
          />
          {rateLimit.buckets.slice(0, 6).map((bucket) => (
            <Row
              key={bucket.bucket}
              label={`Bucket: ${bucket.bucket}`}
              value={`${bucket.rejections} rejected · ${bucket.routes
                .slice(0, 3)
                .map((r) => `${r.route} ×${r.rejections}`)
                .join(", ") || "no routes"}`}
            />
          ))}
        </Section>

        <Section
          title="Cache"
          description="Analytics summary cache outcomes and rebuild cost."
        >
          {cache.length === 0 ? (
            <Row label="Cached reads" value="no cache activity recorded" />
          ) : (
            cache.map((entry) => (
              <Row
                key={entry.name}
                label={`Cache: ${entry.name}`}
                value={`hits ${entry.hits} · misses ${entry.misses} · evictions ${entry.evictions} · hit rate ${
                  entry.hitRate === null ? "—" : `${Math.round(entry.hitRate * 100)} %`
                } · build avg/max ${entry.avgBuildMs}/${entry.maxBuildMs} ms`}
              />
            ))
          )}
        </Section>

        <Section
          title="Internal HTTP"
          description="Server-to-server calls this app makes to its own API routes."
        >
          <Row
            label="Calls / failures"
            value={`${internalFetch.calls} / ${internalFetch.failures}`}
          />
          <Row
            label="Latency (avg / max)"
            value={`${internalFetch.avgMs} / ${internalFetch.maxMs} ms`}
          />
          <Row
            label="Fan-out per request (avg / max)"
            value={
              internalFetch.avgCallsPerRequest === null
                ? "not attributed yet"
                : `${internalFetch.avgCallsPerRequest} / ${internalFetch.maxCallsInOneRequest}`
            }
          />
          <Row
            label="Slowest target"
            value={internalFetch.slowestTarget ?? "—"}
          />
          {internalFetch.targets.slice(0, 6).map((target) => (
            <Row
              key={target.target}
              label={`Target: ${target.target}`}
              value={`${target.calls} calls · ${target.failures} failed · avg/max ${target.avgMs}/${target.maxMs} ms`}
            />
          ))}
        </Section>

        <Section
          title="Planning thresholds"
          description="Phase 16 §11 guidance for review. These are not measurements and not SLO commitments."
        >
          <Row
            label="Latency"
            value={`p95 > ${summary.thresholds.latencyWarnMs} ms investigate · > ${summary.thresholds.latencyCriticalMs} ms optimize`}
          />
          <Row
            label="Server errors"
            value={`sustained 5xx > ${summary.thresholds.serverErrorRateWarnPercent} % investigate`}
          />
          <Row
            label="DB connections"
            value={`> ${summary.thresholds.dbConnectionsWarnPercent} % investigate · > ${summary.thresholds.dbConnectionsCriticalPercent} % escalate`}
          />
          <Row
            label="Ingestion"
            value={`failure rate > ${summary.thresholds.ingestionFailureRateWarnPercent} % or platform timeout approach investigate`}
          />
          <Row
            label="Search"
            value={`p95 > ${summary.thresholds.searchLatencyWarnMs} ms, or corpus > 100,000 jobs with degraded latency → search architecture review`}
          />
          <Row
            label="Rate limiting"
            value={`legitimate rejection rate > ${summary.thresholds.rateLimitRejectionWarnPercent} % review config`}
          />
        </Section>
      </main>
    </div>
  );
}
