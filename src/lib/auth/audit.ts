import { db } from "@/db";
import { auditLog } from "@/db/schema/auditLog";
import { getApiKeyFingerprint } from "@/lib/auth/apiKey";
import { getRequestId } from "@/lib/observability/requestId";

export interface WriteAuditLogParams {
  actorUserId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
}

const SENSITIVE_KEY_HINTS = ["password", "token", "secret", "hash"];

/**
 * Strips sensitive keys and makes metadata JSON-safe. Passwords, raw session
 * tokens, and password hashes are never written to the audit log.
 */
export function sanitizeMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (metadata === null || metadata === undefined) return null;

  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const lower = key.toLowerCase();
    if (SENSITIVE_KEY_HINTS.some((hint) => lower.includes(hint))) continue;
    if (typeof value === "function" || typeof value === "symbol") continue;
    safe[key] = value;
  }

  try {
    return JSON.parse(JSON.stringify(safe)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Best-effort audit insert. Never throws, so auditing can never break the
 * primary operation it accompanies.
 *
 * Attribution enrichment:
 * - API-key mutations declare `metadata.source = "api_key"`. For those events
 *   a non-secret credential fingerprint (derived from the configured
 *   INGESTION_API_KEY) is added as `metadata.credentialId`. The raw key is
 *   never written to the audit log.
 * - When the current request carries a server-generated request ID (middleware
 *   stamps every request with `x-request-id`), it is added as
 *   `metadata.requestId` for correlation.
 */
export async function writeAuditLog(
  params: WriteAuditLogParams,
): Promise<void> {
  const metadataInput = params.metadata ?? {};

  const enriched: Record<string, unknown> = { ...metadataInput };
  if (enriched.source === "api_key") {
    const credentialId = getApiKeyFingerprint();
    if (credentialId) {
      enriched.credentialId = credentialId;
    }
  }

  const requestId = await getRequestId();
  if (requestId) {
    enriched.requestId = requestId;
  }

  const metadata =
    params.metadata === null || params.metadata === undefined
      ? null
      : sanitizeMetadata(enriched);

  try {
    await db.insert(auditLog).values({
      actorUserId: params.actorUserId ?? null,
      action: params.action,
      targetType: params.targetType ?? null,
      targetId: params.targetId ?? null,
      metadata: metadata ?? null,
    });
  } catch {
    // Ignore: audit failure must not fail the primary operation.
  }
}