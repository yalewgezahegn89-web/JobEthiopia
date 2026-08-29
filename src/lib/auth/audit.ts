import { db } from "@/db";
import { auditLog } from "@/db/schema/auditLog";

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
 */
export async function writeAuditLog(
  params: WriteAuditLogParams,
): Promise<void> {
  const metadata = sanitizeMetadata(params.metadata);

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