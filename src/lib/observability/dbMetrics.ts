/**
 * Database observability (Phase 16 Batch 2).
 *
 * Two sources feed this module:
 *  1. the readiness probe in `observability/health.ts` (timing + outcome);
 *  2. a pool-statistics provider registered by `@/db` at module load.
 *
 * The provider indirection is deliberate: `@/db` is heavily mocked in tests,
 * and importing the pool directly from here would break every mock. When no
 * provider is registered (mocked db, or this module loaded standalone) the
 * snapshot degrades to `null` pool statistics instead of throwing.
 *
 * Privacy/security contract (Phase 16 §13/§14):
 *  - Never exposes connection strings, hostnames, ports, database names,
 *    usernames, passwords, SQL text or error messages.
 *  - Only numeric pool counters and configured limits are published.
 *  - Probe results publish duration + boolean outcome only; the underlying
 *    error is never surfaced.
 */

export const MAX_RECENT_DB_PROBES = 50;

export interface PoolStats {
  max: number;
  total: number;
  idle: number;
  waiting: number;
  connectTimeoutMs: number;
  idleTimeoutMs: number;
}

export interface DatabaseProbeSnapshot {
  checks: number;
  failures: number;
  successRate: number | null;
  lastOk: boolean | null;
  lastDurationMs: number | null;
  lastAt: number | null;
  maxDurationMs: number;
  avgDurationMs: number;
  recent: Array<{ at: number; ok: boolean; durationMs: number }>;
}

export interface DatabaseSnapshot {
  pool: (PoolStats & { active: number; utilisationPercent: number | null }) | null;
  probe: DatabaseProbeSnapshot;
}

type PoolStatsProvider = () => PoolStats | null;

interface DbMetricsState {
  provider: PoolStatsProvider | null;
  checks: number;
  failures: number;
  totalDurationMs: number;
  lastOk: boolean | null;
  lastDurationMs: number | null;
  lastAt: number | null;
  maxDurationMs: number;
  recent: Array<{ at: number; ok: boolean; durationMs: number }>;
}

function createState(): DbMetricsState {
  return {
    provider: null,
    checks: 0,
    failures: 0,
    totalDurationMs: 0,
    lastOk: null,
    lastDurationMs: null,
    lastAt: null,
    maxDurationMs: 0,
    recent: [],
  };
}

let state: DbMetricsState = createState();

/**
 * Registers the function that reads live pool counters. Called once by
 * `@/db`; registering replaces any previous provider.
 */
export function registerPoolStatsProvider(provider: PoolStatsProvider): void {
  try {
    state.provider = provider;
  } catch {
    // Never break the caller.
  }
}

/** Records one readiness probe outcome. Never throws. */
export function recordDbProbe(input: {
  ok: boolean;
  durationMs: number;
  at?: number;
}): void {
  try {
    const durationMs =
      Number.isFinite(input.durationMs) && input.durationMs >= 0
        ? Math.round(input.durationMs)
        : 0;
    const at = input.at ?? Date.now();
    state.checks += 1;
    if (!input.ok) state.failures += 1;
    state.totalDurationMs += durationMs;
    state.maxDurationMs = Math.max(state.maxDurationMs, durationMs);
    state.lastOk = input.ok;
    state.lastDurationMs = durationMs;
    state.lastAt = at;
    state.recent.push({ at, ok: input.ok, durationMs });
    if (state.recent.length > MAX_RECENT_DB_PROBES) {
      state.recent.splice(0, state.recent.length - MAX_RECENT_DB_PROBES);
    }
  } catch {
    // Never break the probe.
  }
}

/** Returns pool counters + probe history. Pool section is `null` when unknown. */
export function getDatabaseSnapshot(): DatabaseSnapshot {
  try {
    let pool: DatabaseSnapshot["pool"] = null;
    const provider = state.provider;
    if (provider) {
      const stats = provider();
      if (stats) {
        const active = Math.max(0, stats.total - stats.idle);
        pool = {
          ...stats,
          active,
          utilisationPercent:
            stats.max > 0 ? Math.round((active / stats.max) * 1000) / 10 : null,
        };
      }
    }

    const probe: DatabaseProbeSnapshot = {
      checks: state.checks,
      failures: state.failures,
      successRate:
        state.checks === 0
          ? null
          : Math.round(((state.checks - state.failures) / state.checks) * 1000) /
            1000,
      lastOk: state.lastOk,
      lastDurationMs: state.lastDurationMs,
      lastAt: state.lastAt,
      maxDurationMs: state.maxDurationMs,
      avgDurationMs:
        state.checks === 0 ? 0 : Math.round(state.totalDurationMs / state.checks),
      recent: state.recent.map((p) => ({ ...p })),
    };

    return { pool, probe };
  } catch {
    return {
      pool: null,
      probe: {
        checks: 0,
        failures: 0,
        successRate: null,
        lastOk: null,
        lastDurationMs: null,
        lastAt: null,
        maxDurationMs: 0,
        avgDurationMs: 0,
        recent: [],
      },
    };
  }
}

/** Clears collected database metrics (tests / operator reset). Never throws. */
export function resetDatabaseMetrics(): void {
  try {
    const provider = state.provider;
    state = createState();
    state.provider = provider;
  } catch {
    // Never break the caller.
  }
}
