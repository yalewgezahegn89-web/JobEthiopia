import { db } from "@/db";
import { users } from "@/db/schema/users";
import { auditLog } from "@/db/schema/auditLog";
import { hashPassword } from "@/lib/auth/password";
import { normalizeEmail } from "@/lib/auth/login";
import { registerSchema } from "./schema";

/**
 * Thin reusable registration DAL (Batch 95).
 *
 * Performs all account-creation mutations in a single transaction:
 *   1. normalizes the email (reusing the canonical normalizeEmail)
 *   2. hashes the password with scrypt
 *   3. inserts the user with an explicit role "CANDIDATE" (never client-supplied)
 *   4. writes the CANDIDATE_REGISTERED audit event
 *
 * Identity, role, and isActive are never taken from client input. No candidate
 * profile row, no validation state, and no organization membership are created.
 * The database unique index on users.email is the ultimate concurrency guard;
 * a unique violation rolls back the transaction and is mapped to a stable,
 * neutral result that never reveals whether an account existed.
 */

export type RegisterCandidateResult =
  | { ok: true; userId: string }
  | { ok: false; code: "invalid_input" | "duplicate" | "error" };

export function isDuplicateError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.message.includes("users_email_unique") ||
    (err as { code?: unknown }).code === "23505"
  );
}

export async function registerCandidate(
  rawInput: unknown,
): Promise<RegisterCandidateResult> {
  const parsed = registerSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, code: "invalid_input" };

  const { name, password } = parsed.data;
  const email = normalizeEmail(parsed.data.email);

  const passwordHash = await hashPassword(password);

  try {
    const result = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(users)
        .values({
          email,
          name,
          passwordHash,
          role: "CANDIDATE",
        })
        .returning({ id: users.id });

      await tx.insert(auditLog).values({
        actorUserId: inserted.id,
        action: "CANDIDATE_REGISTERED",
        targetType: "user",
        targetId: inserted.id,
        metadata: {},
      });

      return { ok: true as const, userId: inserted.id };
    });

    return result;
  } catch (err) {
    if (isDuplicateError(err)) return { ok: false, code: "duplicate" };
    return { ok: false, code: "error" };
  }
}
