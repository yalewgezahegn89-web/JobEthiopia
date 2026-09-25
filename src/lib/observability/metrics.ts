/**
 * First-party operational metrics (Phase 16 Batch 2).
 *
 * A bounded, in-process registry for the counters the application cannot get
 * from its stdout-only structured logs: request volume/latency/status classes,
 * rate-limit rejections, analytics-summary cache behaviour, internal HTTP
 * fan-out, and ingestion runs.
 *
 * Design rules (Phase 16 Batch 2 operating rules):
 *  - Process-local and in-memory. No Redis, no queue, no telemetry backend.
 *    Cold starts and multi-instance deployments lose/reset this state; the
 *    authoritative production channel remains the structured stdout logs and
 *    the runbook in `OPERATIONS.md`.
 *  - Edge-safe: no Node-only imports (this module is loaded from middleware).
 *  - Privacy: only route templates/normalized paths, methods, status classes,
 *    durations, bucket names and cache names are stored. Never IP, user
 *    agent, email, phone, tokens, request bodies or query strings.
 *  - Every collection is hard-bounded (route count, sample count, history
 *    depth) so memory cannot grow with traffic.
 *  - Never throws: metrics must never break the operation being measured.
 */

/* ── Bounds ─────────────────────────────────────────────────────────────── */

/** Maximum distinct route series before overflow routes are bucketed. */
export const MAX_ROUTE_SERIES = 200;
/** Per-route duration samples retained for percentile computation. */
export const ROUTE_SAMPLE_CAP = 500;
/** Global duration samples retained for whole-app percentiles. */
export const GLOBAL_SAMPLE_CAP = 4_000;
/** Distinct minute buckets retained per rate-limit bucket. */
export const TIME_BUCKET_CAP = 60;
/** Ingestion runs retained in the in-process ring. */
export const INGESTION_RUN_CAP = 20;
/** Request-scoped internal-fetch attributions retained. */
export const REQUEST_ATTRIBUTION_CAP = 64;
/** Distinct internal-fetch targets retained. */
export const TARGET_SERIES_CAP = 100;

/* ── Types ──────────────────────────────────────────────────────────────── */

export type StatusClass = "2xx" | "3xx" | "4xx" | "5xx";

export interface RouteSeriesSnapshot {
  route: string;
  method: string;
  count: number;
  statusClasses: Record<StatusClass, number>;
  clientErrors: number;
  serverErrors: number;
  totalMs: number;
  avgMs: number;
  minMs: number | null;
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
}

export interface RequestMetricsSnapshot {
  /** Distinct route×method series held (bounded by MAX_ROUTE_SERIES). */
  series: number;
  /** True when at least one route was folded into the "other" series. */
  overflow: boolean;
  startedAt: number | null;
  updatedAt: number | null;
  total: number;
  statusClasses: Record<StatusClass, number>;
  clientErrors: number;
  serverErrors: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  routes: RouteSeriesSnapshot[];
}

export interface RateLimitSeriesSnapshot {
  bucket: string;
  rejections: number;
  routes: Array<{ route: string; rejections: number }>;
  timeBuckets: Array<{ minute: string; rejections: number }>;
}

export interface RateLimitMetricsSnapshot {
  rejections: number;
  buckets: RateLimitSeriesSnapshot[];
}

export interface CacheSeriesSnapshot {
  name: string;
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number | null;
  builds: number;
  avgBuildMs: number;
  maxBuildMs: number;
  lastBuildMs: number | null;
}

export interface InternalFetchTargetSnapshot {
  target: string;
  calls: number;
  failures: number;
  avgMs: number;
  maxMs: number;
}

export interface InternalFetchMetricsSnapshot {
  calls: number;
  failures: number;
  totalMs: number;
  avgMs: number;
  maxMs: number;
  slowestTarget: string | null;
  /** Requests that had at least one internal fetch (bounded attribution). */
  attributedRequests: number;
  avgCallsPerRequest: number | null;
  maxCallsInOneRequest: number;
  targets: InternalFetchTargetSnapshot[];
}

export interface IngestionRunSnapshot {
  at: number;
  status: "SUCCEEDED" | "PARTIAL" | "FAILED";
  durationMs: number;
  sourcesAttempted: number;
  sourcesSucceeded: number;
  sourcesFailed: number;
  sourcesSkipped: number;
  jobsReceived: number;
  jobsCreated: number;
  jobsUpdated: number;
  duplicates: number;
  failedRecords: number;
  autoDeactivatedSources: number;
}

export interface IngestionMetricsSnapshot {
  runs: number;
  succeeded: number;
  failed: number;
  lastRun: IngestionRunSnapshot | null;
  history: IngestionRunSnapshot[];
}

/* ── Internal state ─────────────────────────────────────────────────────── */

interface DurationSeries {
  count: number;
  totalMs: number;
  minMs: number | null;
  maxMs: number;
  /** Ring buffer of retained samples. */
  samples: number[];
  writeIndex: number;
}

interface RouteSeries extends DurationSeries {
  route: string;
  method: string;
  statusClasses: Record<StatusClass, number>;
}

interface CacheSeries {
  name: string;
  hits: number;
  misses: number;
  evictions: number;
  builds: number;
  buildTotalMs: number;
  maxBuildMs: number;
  lastBuildMs: number | null;
}

interface InternalFetchTarget extends DurationSeries {
  target: string;
  failures: number;
}

interface RateLimitBucketSeries {
  bucket: string;
  rejections: number;
  routes: Map<string, number>;
  timeBuckets: Map<string, number>;
}

interface RequestAttribution {
  calls: number;
  totalMs: number;
}

interface MetricsState {
  routes: Map<string, RouteSeries>;
  overflow: boolean;
  startedAt: number | null;
  updatedAt: number | null;
  global: DurationSeries;
  globalStatus: Record<StatusClass, number>;
  rateLimits: Map<string, RateLimitBucketSeries>;
  caches: Map<string, CacheSeries>;
  fetchTargets: Map<string, InternalFetchTarget>;
  fetchCalls: number;
  fetchFailures: number;
  fetchTotalMs: number;
  fetchMaxMs: number;
  fetchMaxTarget: string | null;
  fetchByRequest: Map<string, RequestAttribution>;
  ingestion: IngestionRunSnapshot[];
}

function emptyDuration(): DurationSeries {
  return {
    count: 0,
    totalMs: 0,
    minMs: null,
    maxMs: 0,
    samples: [],
    writeIndex: 0,
  };
}

function emptyStatus(): Record<StatusClass, number> {
  return { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 };
}

function createState(): MetricsState {
  return {
    routes: new Map(),
    overflow: false,
    startedAt: null,
    updatedAt: null,
    global: emptyDuration(),
    globalStatus: emptyStatus(),
    rateLimits: new Map(),
    caches: new Map(),
    fetchTargets: new Map(),
    fetchCalls: 0,
    fetchFailures: 0,
    fetchTotalMs: 0,
    fetchMaxMs: 0,
    fetchMaxTarget: null,
    fetchByRequest: new Map(),
    ingestion: [],
  };
}

let state: MetricsState = createState();

/* ── Helpers (exported for reuse/tests) ─────────────────────────────────── */

/** Maps an HTTP status to its class bucket. */
export function statusClassOf(status: number): StatusClass {
  if (status >= 500) return "5xx";
  if (status >= 400) return "4xx";
  if (status >= 300) return "3xx";
  return "2xx";
}

/**
 * Nearest-rank percentile over an already-ascending sample set.
 * Returns 0 for an empty set so callers never see NaN.
 */
export function percentile(sortedAscending: number[], p: number): number {
  if (sortedAscending.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sortedAscending.length);
  const index = Math.min(Math.max(rank - 1, 0), sortedAscending.length - 1);
  return Math.round(sortedAscending[index]);
}

function recordDuration(series: DurationSeries, durationMs: number, cap: number): void {
  const ms = Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : 0;
  series.count += 1;
  series.totalMs += ms;
  series.minMs = series.minMs === null ? ms : Math.min(series.minMs, ms);
  series.maxMs = Math.max(series.maxMs, ms);
  if (series.samples.length < cap) {
    series.samples.push(ms);
  } else {
    series.samples[series.writeIndex % cap] = ms;
    series.writeIndex += 1;
  }
}

function sortedSamples(series: DurationSeries): number[] {
  return [...series.samples].sort((a, b) => a - b);
}

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC = /^\d+$/;
const HEXISH = /^[0-9a-f]{16,}$/i;
const LOCALES = new Set(["en", "am", "om"]);

/** Roots whose direct child segment is a resource identifier or slug. */
const DETAIL_ROOTS = new Set([
  "jobs",
  "careers",
  "categories",
  "locations",
  "professions",
  "organizations",
  "applications",
  "recommendations",
]);

const MAX_ROUTE_DEPTH = 4;
const OVERFLOW_ROUTE = "other";

/**
 * Normalizes a request pathname into a bounded, non-identifying route key.
 *
 * Strips the locale prefix, replaces identifier-shaped segments with `:id` /
 * `:slug` (detail roots always collapse their child), and caps depth. Query
 * strings are never part of the input contract: callers must pass a pathname
 * only. The result must never contain user input such as search terms.
 */
export function normalizeRoutePath(pathname: string): string {
  try {
    const withoutQuery = pathname.split("?")[0].split("#")[0];
    let segments = withoutQuery.split("/").filter((s) => s.length > 0);
    if (segments.length > 0 && LOCALES.has(segments[0].toLowerCase())) {
      segments = segments.slice(1);
    }
    if (segments.length === 0) return "/";

    const out: string[] = [];
    for (let i = 0; i < segments.length && i < MAX_ROUTE_DEPTH; i += 1) {
      const segment = segments[i];
      const previous = i > 0 ? segments[i - 1] : undefined;
      if (UUID_LIKE.test(segment) || NUMERIC.test(segment) || HEXISH.test(segment)) {
        out.push(":id");
        continue;
      }
      if (previous !== undefined && DETAIL_ROOTS.has(previous.toLowerCase())) {
        out.push(":slug");
        continue;
      }
      out.push(segment);
    }
    if (segments.length > MAX_ROUTE_DEPTH) out.push("*");
    return "/" + out.join("/");
  } catch {
    return "/";
  }
}

/* ── Request metrics ────────────────────────────────────────────────────── */

export interface RecordApiRequestInput {
  route: string;
  method: string;
  status: number;
  durationMs: number;
}

/**
 * Records one completed API request. Route keys are caller-supplied route
 * templates (e.g. `/api/jobs/[id]`), never raw URLs.
 */
export function recordApiRequest(input: RecordApiRequestInput): void {
  try {
    const route = input.route || "unknown";
    const method = (input.method || "GET").toUpperCase();
    const key = `${method} ${route}`;
    const status = Number.isFinite(input.status) ? input.status : 500;
    const statusClass = statusClassOf(status);

    let series = state.routes.get(key);
    if (!series && state.routes.size >= MAX_ROUTE_SERIES) {
      state.overflow = true;
      const overflowKey = `${method} ${OVERFLOW_ROUTE}`;
      series = state.routes.get(overflowKey);
      if (!series) {
        series = { route: OVERFLOW_ROUTE, method, statusClasses: emptyStatus(), ...emptyDuration() };
        state.routes.set(overflowKey, series);
      }
    }
    if (!series) {
      series = { route, method, statusClasses: emptyStatus(), ...emptyDuration() };
      state.routes.set(key, series);
    }

    recordDuration(series, input.durationMs, ROUTE_SAMPLE_CAP);
    series.statusClasses[statusClass] += 1;

    recordDuration(state.global, input.durationMs, GLOBAL_SAMPLE_CAP);
    state.globalStatus[statusClass] += 1;

    const now = Date.now();
    state.startedAt = state.startedAt ?? now;
    state.updatedAt = now;
  } catch {
    // Metrics must never break the request.
  }
}

function durationSnapshot(series: DurationSeries) {
  const sorted = sortedSamples(series);
  return {
    count: series.count,
    totalMs: series.totalMs,
    minMs: series.minMs,
    maxMs: series.maxMs,
    avgMs: series.count === 0 ? 0 : Math.round(series.totalMs / series.count),
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
    p99Ms: percentile(sorted, 99),
  };
}

/** Returns a sorted, bounded snapshot of the request metrics. */
export function getRequestMetrics(): RequestMetricsSnapshot {
  try {
    const routes: RouteSeriesSnapshot[] = [];
    let total = 0;
    const statusClasses = emptyStatus();
    let clientErrors = 0;
    let serverErrors = 0;

    for (const series of state.routes.values()) {
      const durations = durationSnapshot(series);
      total += series.count;
      statusClasses["2xx"] += series.statusClasses["2xx"];
      statusClasses["3xx"] += series.statusClasses["3xx"];
      statusClasses["4xx"] += series.statusClasses["4xx"];
      statusClasses["5xx"] += series.statusClasses["5xx"];
      clientErrors += series.statusClasses["4xx"];
      serverErrors += series.statusClasses["5xx"];
      routes.push({
        route: series.route,
        method: series.method,
        count: series.count,
        statusClasses: { ...series.statusClasses },
        clientErrors: series.statusClasses["4xx"],
        serverErrors: series.statusClasses["5xx"],
        totalMs: durations.totalMs,
        avgMs: durations.avgMs,
        minMs: durations.minMs,
        maxMs: durations.maxMs,
        p50Ms: durations.p50Ms,
        p95Ms: durations.p95Ms,
        p99Ms: durations.p99Ms,
      });
    }

    routes.sort((a, b) => b.count - a.count || a.route.localeCompare(b.route));
    const global = durationSnapshot(state.global);

    return {
      series: state.routes.size,
      overflow: state.overflow,
      startedAt: state.startedAt,
      updatedAt: state.updatedAt,
      total,
      statusClasses,
      clientErrors,
      serverErrors,
      avgMs: global.avgMs,
      p50Ms: global.p50Ms,
      p95Ms: global.p95Ms,
      p99Ms: global.p99Ms,
      routes,
    };
  } catch {
    return {
      series: 0,
      overflow: false,
      startedAt: null,
      updatedAt: null,
      total: 0,
      statusClasses: emptyStatus(),
      clientErrors: 0,
      serverErrors: 0,
      avgMs: 0,
      p50Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
      routes: [],
    };
  }
}

/* ── Rate-limit metrics ─────────────────────────────────────────────────── */

export interface RecordRateLimitRejectionInput {
  bucket: string;
  route: string;
  /** Epoch milliseconds; injectable so tests never depend on the clock. */
  at?: number;
}

/**
 * Records one rate-limit rejection. Only the bucket name, a normalized route
 * and a minute bucket are stored — never IP, key material or identity.
 */
export function recordRateLimitRejection(input: RecordRateLimitRejectionInput): void {
  try {
    const bucket = input.bucket || "unknown";
    const route = normalizeRoutePath(input.route || "/");
    const at = input.at ?? Date.now();
    const minute = new Date(Math.floor(at / 60_000) * 60_000).toISOString();

    let series = state.rateLimits.get(bucket);
    if (!series) {
      series = { bucket, rejections: 0, routes: new Map(), timeBuckets: new Map() };
      state.rateLimits.set(bucket, series);
    }

    series.rejections += 1;
    series.routes.set(route, (series.routes.get(route) ?? 0) + 1);
    series.timeBuckets.set(minute, (series.timeBuckets.get(minute) ?? 0) + 1);
    while (series.timeBuckets.size > TIME_BUCKET_CAP) {
      const oldest = series.timeBuckets.keys().next();
      if (oldest.done) break;
      series.timeBuckets.delete(oldest.value);
    }
  } catch {
    // Metrics must never break the request.
  }
}

/** Returns a snapshot of aggregate rate-limit rejections. */
export function getRateLimitMetrics(): RateLimitMetricsSnapshot {
  try {
    let rejections = 0;
    const buckets: RateLimitSeriesSnapshot[] = [];
    for (const series of state.rateLimits.values()) {
      rejections += series.rejections;
      const routes = [...series.routes.entries()]
        .map(([route, count]) => ({ route, rejections: count }))
        .sort((a, b) => b.rejections - a.rejections)
        .slice(0, 20);
      const timeBuckets = [...series.timeBuckets.entries()]
        .map(([minute, count]) => ({ minute, rejections: count }))
        .sort((a, b) => b.minute.localeCompare(a.minute));
      buckets.push({ bucket: series.bucket, rejections: series.rejections, routes, timeBuckets });
    }
    buckets.sort((a, b) => b.rejections - a.rejections);
    return { rejections, buckets };
  } catch {
    return { rejections: 0, buckets: [] };
  }
}

/* ── Cache metrics ──────────────────────────────────────────────────────── */

export type CacheOutcome = "hit" | "miss" | "evict";

export interface RecordCacheEventInput {
  name: string;
  outcome: CacheOutcome;
  buildDurationMs?: number;
}

/** Records one analytics cache outcome and, on a miss, its build duration. */
export function recordCacheEvent(input: RecordCacheEventInput): void {
  try {
    const name = input.name || "unknown";
    let series = state.caches.get(name);
    if (!series) {
      series = { name, hits: 0, misses: 0, evictions: 0, builds: 0, buildTotalMs: 0, maxBuildMs: 0, lastBuildMs: null };
      state.caches.set(name, series);
    }
    if (input.outcome === "hit") series.hits += 1;
    else if (input.outcome === "evict") series.evictions += 1;
    else {
      series.misses += 1;
      if (input.buildDurationMs !== undefined && Number.isFinite(input.buildDurationMs)) {
        const ms = Math.max(0, input.buildDurationMs);
        series.builds += 1;
        series.buildTotalMs += ms;
        series.maxBuildMs = Math.max(series.maxBuildMs, ms);
        series.lastBuildMs = ms;
      }
    }
  } catch {
    // Metrics must never break the operation.
  }
}

/** Returns cache hit/miss/eviction/build statistics. */
export function getCacheMetrics(): CacheSeriesSnapshot[] {
  try {
    const out: CacheSeriesSnapshot[] = [];
    for (const series of state.caches.values()) {
      const observed = series.hits + series.misses;
      out.push({
        name: series.name,
        hits: series.hits,
        misses: series.misses,
        evictions: series.evictions,
        hitRate: observed === 0 ? null : Math.round((series.hits / observed) * 1000) / 1000,
        builds: series.builds,
        avgBuildMs: series.builds === 0 ? 0 : Math.round(series.buildTotalMs / series.builds),
        maxBuildMs: series.maxBuildMs,
        lastBuildMs: series.lastBuildMs,
      });
    }
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  } catch {
    return [];
  }
}

/* ── Internal HTTP fan-out metrics ──────────────────────────────────────── */

export interface RecordInternalFetchInput {
  /** Pathname only — query strings (search terms) must never be supplied. */
  target: string;
  durationMs: number;
  ok: boolean;
  /** Correlation id used to attribute fan-out to a single server request. */
  requestId?: string | undefined;
}

/** Records one internal (server-to-server) HTTP call. */
export function recordInternalFetch(input: RecordInternalFetchInput): void {
  try {
    const target = normalizeRoutePath(input.target || "/");
    const ms = Number.isFinite(input.durationMs) && input.durationMs >= 0 ? input.durationMs : 0;

    state.fetchCalls += 1;
    state.fetchTotalMs += ms;
    if (!input.ok) state.fetchFailures += 1;
    if (ms > state.fetchMaxMs) {
      state.fetchMaxMs = ms;
      state.fetchMaxTarget = target;
    }

    let series = state.fetchTargets.get(target);
    if (!series && state.fetchTargets.size >= TARGET_SERIES_CAP) {
      series = state.fetchTargets.get(OVERFLOW_ROUTE);
      if (!series) {
        series = { target: OVERFLOW_ROUTE, failures: 0, ...emptyDuration() };
        state.fetchTargets.set(OVERFLOW_ROUTE, series);
      }
    }
    if (!series) {
      series = { target, failures: 0, ...emptyDuration() };
      state.fetchTargets.set(target, series);
    }
    recordDuration(series, ms, ROUTE_SAMPLE_CAP);
    if (!input.ok) series.failures += 1;

    const requestId = input.requestId;
    if (requestId) {
      const existing = state.fetchByRequest.get(requestId);
      if (existing) {
        existing.calls += 1;
        existing.totalMs += ms;
      } else {
        while (state.fetchByRequest.size >= REQUEST_ATTRIBUTION_CAP) {
          const oldest = state.fetchByRequest.keys().next();
          if (oldest.done) break;
          state.fetchByRequest.delete(oldest.value);
        }
        state.fetchByRequest.set(requestId, { calls: 1, totalMs: ms });
      }
    }
  } catch {
    // Metrics must never break the fetch.
  }
}

/** Returns a snapshot of internal HTTP fan-out cost. */
export function getInternalFetchMetrics(): InternalFetchMetricsSnapshot {
  try {
    const targets: InternalFetchTargetSnapshot[] = [];
    for (const series of state.fetchTargets.values()) {
      const durations = durationSnapshot(series);
      targets.push({
        target: series.target,
        calls: series.count,
        failures: series.failures,
        avgMs: durations.avgMs,
        maxMs: durations.maxMs,
      });
    }
    targets.sort((a, b) => b.maxMs - a.maxMs || b.calls - a.calls);

    let attributedRequests = 0;
    let attributedCalls = 0;
    let maxCallsInOneRequest = 0;
    for (const attribution of state.fetchByRequest.values()) {
      attributedRequests += 1;
      attributedCalls += attribution.calls;
      maxCallsInOneRequest = Math.max(maxCallsInOneRequest, attribution.calls);
    }

    return {
      calls: state.fetchCalls,
      failures: state.fetchFailures,
      totalMs: state.fetchTotalMs,
      avgMs: state.fetchCalls === 0 ? 0 : Math.round(state.fetchTotalMs / state.fetchCalls),
      maxMs: state.fetchMaxMs,
      slowestTarget: state.fetchMaxTarget,
      attributedRequests,
      avgCallsPerRequest:
        attributedRequests === 0 ? null : Math.round((attributedCalls / attributedRequests) * 100) / 100,
      maxCallsInOneRequest,
      targets,
    };
  } catch {
    return {
      calls: 0,
      failures: 0,
      totalMs: 0,
      avgMs: 0,
      maxMs: 0,
      slowestTarget: null,
      attributedRequests: 0,
      avgCallsPerRequest: null,
      maxCallsInOneRequest: 0,
      targets: [],
    };
  }
}

/* ── Ingestion run metrics ──────────────────────────────────────────────── */

/** Coerces a possibly-missing counter to a safe non-negative integer. */
function safeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : 0;
}

/** Records one ingestion run (started/completed/failed) in a bounded ring. */
export function recordIngestionRun(run: IngestionRunSnapshot): void {
  try {
    const at =
      typeof run.at === "number" && Number.isFinite(run.at) && run.at > 0
        ? run.at
        : Date.now();
    state.ingestion.unshift({
      at,
      status:
        run.status === "FAILED"
          ? "FAILED"
          : run.status === "PARTIAL"
            ? "PARTIAL"
            : "SUCCEEDED",
      durationMs: safeCount(run.durationMs),
      sourcesAttempted: safeCount(run.sourcesAttempted),
      sourcesSucceeded: safeCount(run.sourcesSucceeded),
      sourcesFailed: safeCount(run.sourcesFailed),
      sourcesSkipped: safeCount(run.sourcesSkipped),
      jobsReceived: safeCount(run.jobsReceived),
      jobsCreated: safeCount(run.jobsCreated),
      jobsUpdated: safeCount(run.jobsUpdated),
      duplicates: safeCount(run.duplicates),
      failedRecords: safeCount(run.failedRecords),
      autoDeactivatedSources: safeCount(run.autoDeactivatedSources),
    });
    if (state.ingestion.length > INGESTION_RUN_CAP) {
      state.ingestion.length = INGESTION_RUN_CAP;
    }
  } catch {
    // Metrics must never break the run.
  }
}

/** Returns ingestion run history and totals. */
export function getIngestionMetrics(): IngestionMetricsSnapshot {
  try {
    const history = state.ingestion.map((run) => ({ ...run }));
    return {
      runs: history.length,
      succeeded: history.filter((r) => r.status === "SUCCEEDED").length,
      failed: history.filter((r) => r.status === "FAILED").length,
      lastRun: history[0] ?? null,
      history,
    };
  } catch {
    return { runs: 0, succeeded: 0, failed: 0, lastRun: null, history: [] };
  }
}

/* ── Reset (tests / operator action) ────────────────────────────────────── */

/** Clears every in-process metric. Intended for tests and operator resets. */
export function resetOperationalMetrics(): void {
  state = createState();
}
