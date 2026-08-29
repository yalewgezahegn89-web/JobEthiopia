import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { writeAuditLog } from "@/lib/auth/audit";

/**
 * Safe first-admin bootstrap.
 *
 * Credentials come ONLY from environment variables:
 *   ADMIN_BOOTSTRAP_EMAIL, ADMIN_BOOTSTRAP_PASSWORD
 *
 * - Creates a SUPER_ADMIN when no user with that email exists
 * - Idempotent: repeated runs never create a second account or overwrite one
 * - Password is hashed with scrypt and never stored or printed in plaintext
 *
 * Intended manual execution:
 *   npx tsx src/db/bootstrapAdmin.ts
 */
export async function bootstrapAdmin(
  email: string,
  password: string,
): Promise<{ created: boolean; email: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    throw new Error("Bootstrap requires an email and password");
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Bootstrap password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.email, normalizedEmail),
  });

  if (existing) {
    return { created: false, email: normalizedEmail };
  }

  const passwordHash = await hashPassword(password);

  const [created] = await db
    .insert(users)
    .values({
      email: normalizedEmail,
      name: "Administrator",
      passwordHash,
      role: "SUPER_ADMIN",
    })
    .returning({ id: users.id, email: users.email });

  await writeAuditLog({
    actorUserId: created.id,
    action: "BOOTSTRAP_ADMIN",
    targetType: "user",
    targetId: created.id,
    metadata: { role: "SUPER_ADMIN" },
  });

  return { created: true, email: created.email };
}

export async function bootstrapAdminFromEnv(): Promise<void> {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL ?? "";
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "";

  if (!email.trim() || !password) {
    console.error(
      "Admin bootstrap requires ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD environment variables.",
    );
    process.exitCode = 1;
    return;
  }

  try {
    const result = await bootstrapAdmin(email, password);
    if (result.created) {
      console.log(`Admin bootstrap created account for ${result.email}.`);
    } else {
      console.log(`Admin bootstrap skipped: an account for ${result.email} already exists.`);
    }
  } catch (err) {
    console.error("Admin bootstrap failed:", err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}

const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url.replace(/\\/g, "/").endsWith(
    process.argv[1].replace(/\\/g, "/"),
  );

if (isDirectRun) {
  bootstrapAdminFromEnv().finally(() => {
    const pool = (db as { $client?: { end: () => Promise<void> } }).$client;
    pool?.end().catch(() => undefined);
  });
}