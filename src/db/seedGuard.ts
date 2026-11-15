/**
 * Production safety guard for the standalone database seed script.
 *
 * This module is intentionally environment-only. It never reads command-line
 * arguments or request input, so the production confirmation cannot be supplied
 * by an untrusted caller or by simply appending a flag to `npm run db:seed`.
 *
 * Safety is based on two independent signals:
 *   1. Deployment environment (VERCEL_ENV / NODE_ENV).
 *   2. Database target identity, derived only from the normalized hostname of a
 *      validated PostgreSQL DATABASE_URL (credentials are never read back or
 *      logged).
 *
 * Policy summary:
 *   - Missing/malformed DATABASE_URL or missing/ambiguous target configuration
 *     fails closed for remote targets.
 *   - Production seeding requires BOTH the exact production database hostname
 *     and the exact deliberate confirmation token.
 *   - Preview and non-production environments must never target the production
 *     database host. Remote targets must be explicitly allowlisted and the
 *     production host identity must be configured for exclusion.
 *   - VERCEL_ENV=preview is treated as Preview even when NODE_ENV=production.
 *   - Local loopback PostgreSQL targets (localhost, 127.0.0.1, ::1) may be used
 *     in local development only.
 */

export const SEED_PRODUCTION_CONFIRMATION = "CONFIRM_PRODUCTION_SEED";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export type SeedGuardEnv = {
  DATABASE_URL?: string;
  VERCEL_ENV?: string;
  NODE_ENV?: string;
  SEED_ALLOW_PRODUCTION?: string;
  SEED_PRODUCTION_DATABASE_HOST?: string;
  SEED_ALLOWED_DATABASE_HOSTS?: string;
};

export type SeedGuardResult =
  | { allowed: true; environment: "development" | "preview" | "production" }
  | { allowed: false; environment: "production" | "non-production"; reason: string };

function normalized(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

export function normalizeHostname(value: string | undefined): string | null {
  let raw = normalized(value);
  if (!raw) return null;
  // Strip brackets from IPv6 literals (URL.hostname returns "[::1]").
  if (raw.startsWith("[") && raw.endsWith("]")) {
    raw = raw.slice(1, -1);
  }
  // Strip a single trailing dot (FQDN form) for consistent exact matching.
  const host = raw.endsWith(".") ? raw.slice(0, -1) : raw;
  return host || null;
}

function parseAllowedHosts(value: string | undefined): Set<string> {
  if (!value) return new Set();
  return new Set(
    value
      .split(",")
      .map((entry) => normalizeHostname(entry))
      .filter((entry): entry is string => Boolean(entry)),
  );
}

function isLoopbackHost(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname);
}

/** Hosted Vercel Preview, including when NODE_ENV is set to production. */
export function isPreviewSeedEnvironment(env: SeedGuardEnv): boolean {
  return normalized(env.VERCEL_ENV) === "preview";
}

/**
 * True only for an environment that must be treated as Production.
 * VERCEL_ENV=preview takes precedence and is never treated as Production.
 */
export function isProductionSeedEnvironment(env: SeedGuardEnv): boolean {
  if (isPreviewSeedEnvironment(env)) return false;
  if (normalized(env.VERCEL_ENV) === "production") return true;
  return normalized(env.NODE_ENV) === "production";
}

function environmentLabel(
  env: SeedGuardEnv,
): "development" | "preview" | "production" {
  if (isProductionSeedEnvironment(env)) return "production";
  if (isPreviewSeedEnvironment(env)) return "preview";
  return "development";
}

/**
 * Safely extracts and normalizes the hostname from a PostgreSQL DATABASE_URL.
 * The URL (and any credentials) are never logged or returned.
 */
export function parseDatabaseHostname(databaseUrl: string | undefined): string | null {
  if (typeof databaseUrl !== "string" || databaseUrl.trim() === "") {
    return null;
  }
  try {
    const parsed = new URL(databaseUrl);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== "postgres:" && protocol !== "postgresql:") {
      return null;
    }
    return normalizeHostname(parsed.hostname);
  } catch {
    return null;
  }
}

function deny(
  environment: "production" | "non-production",
  reason: string,
): SeedGuardResult {
  return { allowed: false, environment, reason };
}

export function evaluateSeedGuard(env: SeedGuardEnv): SeedGuardResult {
  const dbHost = parseDatabaseHostname(env.DATABASE_URL);
  if (!dbHost) {
    const envKind = isProductionSeedEnvironment(env) ? "production" : "non-production";
    return deny(
      envKind,
      "Refusing to seed: DATABASE_URL is missing, malformed, or not a PostgreSQL connection URL.",
    );
  }

  const productionHost = normalizeHostname(env.SEED_PRODUCTION_DATABASE_HOST);
  const allowedHosts = parseAllowedHosts(env.SEED_ALLOWED_DATABASE_HOSTS);

  // Production environment: require exact production-host match AND explicit
  // confirmation. A confirmation token alone never authorizes an arbitrary DB.
  if (isProductionSeedEnvironment(env)) {
    if (!productionHost) {
      return deny(
        "production",
        "Refusing to seed a production environment: SEED_PRODUCTION_DATABASE_HOST is not configured.",
      );
    }
    if (dbHost !== productionHost) {
      return deny(
        "production",
        "Refusing to seed: DATABASE_URL host does not match the configured production database host.",
      );
    }
    if (env.SEED_ALLOW_PRODUCTION !== SEED_PRODUCTION_CONFIRMATION) {
      return deny(
        "production",
        "Refusing to seed a production database. Set the exact " +
          `SEED_ALLOW_PRODUCTION="${SEED_PRODUCTION_CONFIRMATION}" environment ` +
          "variable only for a deliberate production seed operation.",
      );
    }
    return { allowed: true, environment: "production" };
  }

  // Preview / development / unknown non-production environments.
  // The production host identity must be known for any remote target so the
  // guard can reliably exclude the production database. Missing or ambiguous
  // configuration fails closed for remote targets.
  if (productionHost && dbHost === productionHost) {
    return deny(
      "non-production",
      "Refusing to seed: DATABASE_URL targets the configured production database host.",
    );
  }

  if (isLoopbackHost(dbHost)) {
    // Loopback is only permitted for genuine local development (not hosted
    // Preview, which must use an explicitly allowlisted remote target).
    if (isPreviewSeedEnvironment(env)) {
      return deny(
        "non-production",
        "Refusing to seed: preview environments must use an explicitly allowlisted non-production database host.",
      );
    }
    return { allowed: true, environment: "development" };
  }

  // Remote non-production target: require configured production-host identity
  // for exclusion and require an exact allowlist match. No substring/wildcards.
  if (!productionHost) {
    return deny(
      "non-production",
      "Refusing to seed: SEED_PRODUCTION_DATABASE_HOST must be configured to validate remote database targets.",
    );
  }
  if (!allowedHosts.has(dbHost)) {
    return deny(
      "non-production",
      "Refusing to seed: DATABASE_URL host is not in SEED_ALLOWED_DATABASE_HOSTS.",
    );
  }

  return { allowed: true, environment: environmentLabel(env) };
}

/**
 * Throws before the seed script opens a database pool when the environment or
 * database target has not been explicitly validated as safe.
 */
export function assertSeedAllowed(env: SeedGuardEnv): void {
  const result = evaluateSeedGuard(env);
  if (!result.allowed) {
    throw new Error(result.reason);
  }
}
