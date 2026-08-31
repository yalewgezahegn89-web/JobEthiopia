import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import * as schema from "./schema";

/**
 * Conservative PostgreSQL pool configuration for a small Next.js / serverless
 * deployment.
 *
 * - `connectionTimeoutMillis`: finite cap so a hung/managed endpoint cannot
 *   stall requests forever (pg defaults to 0 == infinite).
 * - `max`: modest client count (pg default is 10); fine for a small app and for
 *   serverless concurrency against a single managed database.
 * - `idleTimeoutMillis`: evict idle clients to avoid connection churn across
 *   serverless cold boots.
 * - `ssl`: managed production PostgreSQL requires TLS. Enabled in production
 *   unless explicitly disabled. Certificates are never hard-coded; default CA
 *   verification is used, and operators that need a custom CA or `sslmode`
 *   should supply it via the standard `DATABASE_URL` query parameters, which
 *   take precedence over the object form below.
 *
 * All of these are environment-tunable; local development keeps its existing
 * behavior when none of the variables are set.
 */
export function getPoolConfig(): PoolConfig {
  const connectionString = process.env.DATABASE_URL;

  const connectionTimeoutMillis = toPositiveInt(
    process.env.PG_CONNECTION_TIMEOUT_MS,
    10_000,
  );
  const max = toPositiveInt(process.env.PG_POOL_MAX, 10);
  const idleTimeoutMillis = toPositiveInt(process.env.PG_IDLE_TIMEOUT_MS, 30_000);

  const config: PoolConfig = {
    connectionString,
    connectionTimeoutMillis,
    max,
    idleTimeoutMillis,
  };

  const disableSsl = process.env.PG_DISABLE_SSL === "true";
  const sslModeInUrl = /[?&]sslmode=/i.test(connectionString ?? "");
  if (!disableSsl && !sslModeInUrl && process.env.NODE_ENV === "production") {
    config.ssl = { rejectUnauthorized: true };
  }

  return config;
}

function toPositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const pool = new Pool(getPoolConfig());

export const db = drizzle(pool, { schema });
