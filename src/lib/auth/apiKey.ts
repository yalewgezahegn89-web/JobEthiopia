import { timingSafeEqual } from "node:crypto";

/**
 * Centralized API-key verification bridge (Batch 50).
 *
 * Existing mutation routes keep their current behavior until Batch 54, but this
 * module is the single migration point for that duplicated logic. It preserves
 * the historical semantics: 500 when the key is not configured, 401 when the
 * key is missing or wrong — and never leaks the configured secret.
 */

export type ApiKeyCheckResult =
  | { ok: true }
  | { ok: false; status: number; message: string };

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function checkApiKey(request: Request): ApiKeyCheckResult {
  const configuredKey = process.env.INGESTION_API_KEY;

  if (!configuredKey) {
    return { ok: false, status: 500, message: "Server configuration error" };
  }

  const providedKey = request.headers.get("x-api-key") ?? "";
  if (!providedKey || !constantTimeEqual(providedKey, configuredKey)) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }

  return { ok: true };
}