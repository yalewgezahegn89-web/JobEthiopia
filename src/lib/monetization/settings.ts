/**
 * Central advertising configuration + validation.
 *
 * Every advertising environment value is read and validated here so page
 * components and the provider boundary never scatter `process.env` reads or
 * ad-hoc parsing. The runtime path uses `readAdvertisingSettings` (lenient —
 * bad values simply disable the relevant dimension); `validateAdvertisingEnv`
 * exposes the same rules as a structured zod result for configuration tests
 * and operator tooling.
 *
 * Production secrets/documentation rules still apply: never log or store the
 * raw DATABASE_URL or any credential here — only advertising switches.
 */
import { z } from "zod";
import { AD_PLACEMENTS, type AdPlacementId } from "./config";

export const ADVERTISING_ENV_KEYS = [
  "MONETIZATION_ENABLED",
  "AD_PROVIDER",
  "AD_CONSENT_REQUIRED",
] as const;

export type AdvertisingSettings = {
  enabled: boolean;
  providerQuery: string | null;
  consentRequired: boolean;
  placements: readonly AdPlacementId[];
};

const booleanSwitch = z.enum(["true", "false"]);

const ADVERTISING_ENV_SCHEMA = z.object({
  MONETIZATION_ENABLED: booleanSwitch,
  AD_CONSENT_REQUIRED: booleanSwitch,
  AD_PROVIDER: z.string().trim().min(1).max(64),
});

function normalizeEnv(
  env: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const key of ADVERTISING_ENV_KEYS) {
    const value = env[key];
    out[key] =
      typeof value === "string" && value.trim() === "" ? undefined : value;
  }
  return out;
}

export type AdvertisingEnvValidation =
  | { valid: true; settings: AdvertisingSettings }
  | { valid: false; issues: string[] };

/** Strict configuration validation (malformed input is reported, not masked). */
export function validateAdvertisingEnv(
  env: Record<string, string | undefined>,
): AdvertisingEnvValidation {
  const normalized = normalizeEnv(env);
  const parsed = ADVERTISING_ENV_SCHEMA.safeParse(normalized);
  if (!parsed.success) {
    return {
      valid: false,
      issues: parsed.error.issues.map(
        (issue) =>
          `${(issue.path.join(".") || "value")}: ${issue.message}`,
      ),
    };
  }
  return {
    valid: true,
    settings: {
      enabled: parsed.data.MONETIZATION_ENABLED === "true",
      providerQuery:
        parsed.data.AD_PROVIDER.length > 0 ? parsed.data.AD_PROVIDER : null,
      consentRequired: parsed.data.AD_CONSENT_REQUIRED === "true",
      placements: AD_PLACEMENTS.map((placement) => placement.id),
    },
  };
}

/**
 * Lenient runtime reader: unset/malformed values disable the corresponding
 * dimension rather than throwing. Mirrors `isMonetizationEnabled` semantics
 * (opt-in on the exact string "true").
 */
export function readAdvertisingSettings(
  env: NodeJS.ProcessEnv = process.env,
): AdvertisingSettings {
  return {
    enabled: env.MONETIZATION_ENABLED === "true",
    providerQuery: env.AD_PROVIDER?.trim() || null,
    consentRequired: env.AD_CONSENT_REQUIRED === "true",
    placements: AD_PLACEMENTS.map((placement) => placement.id),
  };
}
