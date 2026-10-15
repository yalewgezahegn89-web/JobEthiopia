import { timingSafeEqual } from "node:crypto";
import { logWarn } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/requestId";

/**
 * Centralized internal-route authentication (Phase 8 Batch 1).
 *
 * The three internal automation endpoints (maintenance, ingestion, job-alert
 * digest) historically duplicated an identical timing-safe key check. This
 * module is the single implementation of that check and replaces the copies.
 *
 * Key resolution (rollout-safe):
 *  - `keyEnvVar`, when set, names the route's dedicated env var
 *    (e.g. `INTERNAL_INGESTION_API_KEY`).
 *  - If that var is unset/blank, the legacy `MAINTENANCE_API_KEY` is used.
 *  - The header is always `x-maintenance-key`.
 *
 * Behavior is preserved verbatim from the copies it replaces:
 *  - 500 "Server configuration error" when no key is configured,
 *  - 401 "Unauthorized" for a missing or mismatched key (non-enumerating),
 *  - constant-time comparison (length guard + timingSafeEqual),
 *  - one safe `internal_route_auth_rejected` warn event per rejection.
 *
 * The raw key is never logged or returned; only route/method/status/errorCode
 * and the request correlation ID are emitted.
 */

export const INTERNAL_AUTH_HEADER = "x-maintenance-key";
export const INTERNAL_AUTH_FALLBACK_ENV = "MAINTENANCE_API_KEY";

export type InternalKeyCheckResult =
  | { ok: true }
  | { ok: false; status: number; message: string };

export interface InternalKeyCheckOptions {
  /** Stable route identifier for logs (e.g. "/api/internal/ingestion/run"). */
  route: string;
  /** Route-dedicated env var name, or unspecified to use the fallback key. */
  keyEnvVar?: string;
  /** HTTP method for logs (defaults to POST). */
  method?: string;
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function checkInternalRouteKey(
  request: Request,
  options: InternalKeyCheckOptions,
): Promise<InternalKeyCheckResult> {
  const requestId = await getRequestId();
  const method = options.method ?? "POST";

  const reject = (
    status: number,
    message: string,
    errorCode: string,
  ): InternalKeyCheckResult => {
    logWarn("internal_route_auth_rejected", {
      requestId,
      route: options.route,
      method,
      status,
      errorCode,
    });
    return { ok: false, status, message };
  };

  const dedicatedKey = options.keyEnvVar
    ? process.env[options.keyEnvVar]
    : undefined;
  const configuredKey =
    dedicatedKey ?? process.env[INTERNAL_AUTH_FALLBACK_ENV];

  if (!configuredKey) {
    return reject(500, "Server configuration error", "AUTH_CONFIG_MISSING");
  }

  const providedKey = request.headers.get(INTERNAL_AUTH_HEADER) ?? "";
  if (!providedKey) {
    return reject(401, "Unauthorized", "AUTH_FAILED");
  }

  if (!constantTimeEqual(providedKey, configuredKey)) {
    return reject(401, "Unauthorized", "AUTH_FAILED");
  }

  return { ok: true };
}