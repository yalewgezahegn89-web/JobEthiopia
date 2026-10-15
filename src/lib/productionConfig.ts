/**
 * Minimal production environment configuration validation (Phase 9 Batch 1).
 *
 * Provides a single `validateProductionConfig()` function that can be called
 * during startup to verify all required production environment variables are
 * present and non-blank. This is intentionally lightweight — it does not
 * replace per-feature validation (e.g. APP_BASE_URL fail-fast in appBaseUrl.ts,
 * MAINTENANCE_API_KEY in internalKey.ts) but gives operators a single upfront
 * check that catches configuration mistakes before the first request.
 *
 * Behavior:
 *   - In non-production (development/test), returns a pass with no checks
 *     so local development is unaffected.
 *   - In production, checks every required variable. Returns a structured
 *     result with pass/fail and the list of missing variable names.
 *   - Never throws. Callers decide whether to fail the process.
 *   - Never logs or returns variable values — only variable names.
 */

export type ProductionConfigCheck = {
  /** Variable name (never the value). */
  variable: string;
  /** Human-readable purpose for operator context. */
  purpose: string;
};

export type ProductionConfigResult = {
  ok: boolean;
  /** Variables that are missing or blank in production. */
  missing: ProductionConfigCheck[];
};

/**
 * Required production environment variables and their purposes.
 *
 * The list intentionally excludes variables that already have their own
 * fail-fast behavior (APP_BASE_URL) or that gracefully degrade when
 * absent (RESEND_API_KEY, RESUME_STORAGE_*). This is the minimal set
 * that must be present for the application to function correctly.
 */
const REQUIRED_IN_PRODUCTION: readonly ProductionConfigCheck[] = [
  {
    variable: "DATABASE_URL",
    purpose: "PostgreSQL connection string",
  },
  {
    variable: "INGESTION_API_KEY",
    purpose: "API key for job ingestion endpoints",
  },
  {
    variable: "MAINTENANCE_API_KEY",
    purpose: "API key for maintenance/internal automation endpoints",
  },
  {
    variable: "INGESTION_ORGANIZATION_ID",
    purpose: "Organization ID for API-key direct job creation",
  },
];

/**
 * Validates the production configuration. Returns a structured result
 * indicating whether all required variables are present.
 *
 * In non-production (NODE_ENV !== "production"), this is a no-op pass
 * so local development and tests are unaffected.
 */
export function validateProductionConfig(): ProductionConfigResult {
  if (process.env.NODE_ENV !== "production") {
    return { ok: true, missing: [] };
  }

  const missing: ProductionConfigCheck[] = [];

  for (const check of REQUIRED_IN_PRODUCTION) {
    const value = process.env[check.variable]?.trim();
    if (!value) {
      missing.push(check);
    }
  }

  return {
    ok: missing.length === 0,
    missing,
  };
}

/**
 * Returns a human-readable summary of the production configuration check.
 * Intended for structured logging, never for stdout that could leak values.
 */
export function formatProductionConfigResult(
  result: ProductionConfigResult,
): string {
  if (result.ok) return "production_config_ok";
  const names = result.missing.map((m) => m.variable).join(", ");
  return `production_config_missing: ${names}`;
}
