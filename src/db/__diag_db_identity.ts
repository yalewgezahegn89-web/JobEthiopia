import { sql, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/users";

/**
 * TEMPORARY READ-ONLY LOCAL DIAGNOSTIC — DO NOT COMMIT.
 *
 * Runs six read-only diagnostic queries SEQUENTIALLY (not in parallel) against
 * the LOCAL DATABASE_URL via the shared `db` singleton. Each query is wrapped
 * in its own timeout so that if any single query hangs, this script reports
 * WHICH query timed out instead of crashing with an opaque stack trace.
 *
 * Prints only non-sensitive metadata; never prints DATABASE_URL, password,
 * password_hash, session tokens, API keys, or cookies. The target admin email
 * is read from AUTH_DIAG_EMAIL (matching the account that was reset).
 *
 * DELETED AFTER USE.
 */

const QUERY_TIMEOUT_MS = 15000;

/**
 * Runs a promise with a timeout and returns a tagged result so the caller can
 * tell exactly which query failed or timed out. It never re-throws the raw
 * error; instead it returns { ok: false, error: <short reason> }.
 */
async function withTimeout<T>(
  label: string,
  work: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("timed out")),
      QUERY_TIMEOUT_MS,
    );
  });
  try {
    const value = await Promise.race([work(), timeout]);
    return { ok: true, value };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const reason = message.toLowerCase().includes("timed out")
      ? `timed out after ${QUERY_TIMEOUT_MS}ms`
      : message;
    return { ok: false, error: `${label}: ${reason}` };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function main(): Promise<void> {
  const email = (process.env.AUTH_DIAG_EMAIL ?? "")
    .trim()
    .toLowerCase();
  if (!email) {
    console.error("Set AUTH_DIAG_EMAIL to select the admin to inspect.");
    process.exitCode = 1;
    return;
  }

  // 1. current_database()
  const q1 = await withTimeout("query 1 (current_database)", async () => {
    const r = await db.execute(sql`SELECT current_database() AS value`);
    return String((r as unknown as { rows: { value: string }[] }).rows[0].value);
  });
  if (!q1.ok) return fail(q1.error);
  const databaseName = q1.value;

  // 2. current_schema()
  const q2 = await withTimeout("query 2 (current_schema)", async () => {
    const r = await db.execute(sql`SELECT current_schema() AS value`);
    return String((r as unknown as { rows: { value: string | null }[] }).rows[0].value);
  });
  if (!q2.ok) return fail(q2.error);
  const schemaName = String(q2.value ?? "");

  // 3. version()
  const q3 = await withTimeout("query 3 (version)", async () => {
    const r = await db.execute(sql`SELECT version() AS value`);
    return String((r as unknown as { rows: { value: string }[] }).rows[0].value);
  });
  if (!q3.ok) return fail(q3.error);
  const serverVersion = q3.value;

  // 4. count(*) FROM users
  const q4 = await withTimeout("query 4 (users count)", async () => {
    const r = await db.execute(sql`SELECT count(*)::int AS value FROM users`);
    return Number((r as unknown as { rows: { value: number }[] }).rows[0].value);
  });
  if (!q4.ok) return fail(q4.error);
  const usersCount = q4.value;

  // 5. count(*) FROM users WHERE role = 'SUPER_ADMIN'
  const q5 = await withTimeout("query 5 (super_admin count)", async () => {
    const r = await db.execute(
      sql`SELECT count(*)::int AS value FROM users WHERE role = 'SUPER_ADMIN'`,
    );
    return Number((r as unknown as { rows: { value: number }[] }).rows[0].value);
  });
  if (!q5.ok) return fail(q5.error);
  const superAdminCount = q5.value;

  // 6. admin account lookup by email
  const q6 = await withTimeout("query 6 (admin lookup)", async () => {
    return db
      .select({
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
  });
  if (!q6.ok) return fail(q6.error);

  const adminRow = q6.value[0] ?? null;
  const admin = adminRow
    ? {
        admin_exists: true,
        admin_role: String(adminRow.role),
        admin_is_active: Boolean(adminRow.isActive),
        admin_created_at: adminRow.createdAt,
        admin_updated_at: adminRow.updatedAt,
      }
    : {
        admin_exists: false,
        admin_role: null,
        admin_is_active: null,
        admin_created_at: null,
        admin_updated_at: null,
      };

  console.log("LOCAL_DATABASE =", JSON.stringify(
    {
      database_name: databaseName,
      schema_name: schemaName,
      server_version: serverVersion,
      users_count: usersCount,
      super_admin_count: superAdminCount,
      ...admin,
    },
    null,
    2,
  ));
}

function fail(error: string): void {
  console.error(`Diagnostic aborted: ${error}`);
  process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(
      "Diagnostic aborted:",
      err instanceof Error ? err.message : String(err),
    );
    process.exitCode = 1;
  })
  .finally(() => {
    const pool = (db as { $client?: { end: () => Promise<void> } }).$client;
    pool?.end().catch(() => undefined);
  });
