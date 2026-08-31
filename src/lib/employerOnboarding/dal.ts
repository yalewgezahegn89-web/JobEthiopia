import { db } from "@/db";
import { users } from "@/db/schema/users";
import { auditLog } from "@/db/schema/auditLog";
import { employerOnboardingRequests } from "@/db/schema/employerOnboardingRequests";
import { hashPassword } from "@/lib/auth/password";
import { normalizeEmail } from "@/lib/auth/login";
import { employerOnboardingSchema } from "./schema";

/**
 * Employer self-service onboarding request DAL (Batch 97).
 *
 * Submits an onboarding request in a single atomic transaction:
 *   1. normalizes the email (reusing the canonical normalizeEmail)
 *   2. hashes the password with scrypt
 *   3. inserts the user with an explicit role "CANDIDATE" (never client-supplied)
 *   4. inserts a PENDING employer onboarding request tied to that user
 *   5. writes the EMPLOYER_ONBOARDING_REQUESTED audit event (PII-safe metadata)
 *
 * The submitter intentionally stays CANDIDATE pending staff review. No
 * organization or membership row is created here; that happens only in the
 * separate, staff-only atomic approval step. The database unique index on
 * users.email is the ultimate concurrency guard — a unique violation rolls
 * back the whole submission and is mapped to a stable, neutral result that
 * never reveals whether an account or request existed.
 */
export type SubmitEmployerOnboardingResult =
  | { ok: true; userId: string; requestId: string }
  | { ok: false; code: "invalid_input" | "duplicate" | "error" };

export function isDuplicateError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.message.includes("users_email_unique") ||
    (err as { code?: unknown }).code === "23505"
  );
}

export async function submitEmployerOnboarding(
  rawInput: unknown,
): Promise<SubmitEmployerOnboardingResult> {
  const parsed = employerOnboardingSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, code: "invalid_input" };

  const {
    name,
    password,
    organizationName,
    organizationSlug,
    industry,
    description,
    websiteUrl,
    contactPhone,
    locationId,
  } = parsed.data;
  const email = normalizeEmail(parsed.data.email);

  const passwordHash = await hashPassword(password);

  try {
    const result = await db.transaction(async (tx) => {
      const [insertedUser] = await tx
        .insert(users)
        .values({
          email,
          name,
          passwordHash,
          role: "CANDIDATE",
        })
        .returning({ id: users.id });

      const [insertedRequest] = await tx
        .insert(employerOnboardingRequests)
        .values({
          userId: insertedUser.id,
          organizationName,
          organizationSlug,
          industry: industry || null,
          description: description || null,
          websiteUrl: websiteUrl || null,
          contactPhone: contactPhone || null,
          locationId: locationId || null,
        })
        .returning({ id: employerOnboardingRequests.id });

      await tx.insert(auditLog).values({
        actorUserId: insertedUser.id,
        action: "EMPLOYER_ONBOARDING_REQUESTED",
        targetType: "employer_onboarding_request",
        targetId: insertedRequest.id,
        metadata: {},
      });

      return {
        ok: true as const,
        userId: insertedUser.id,
        requestId: insertedRequest.id,
      };
    });

    return result;
  } catch (err) {
    if (isDuplicateError(err)) return { ok: false, code: "duplicate" };
    return { ok: false, code: "error" };
  }
}
