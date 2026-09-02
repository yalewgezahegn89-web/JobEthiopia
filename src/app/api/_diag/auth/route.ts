import { NextResponse } from "next/server";
import { sql, eq, count } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db } from "@/db";
import { users } from "@/db/schema/users";

/**
 * TEMPORARY READ-ONLY DIAGNOSTIC — DO NOT DEPLOY.
 *
 * Disabled by default. It only responds when AUTH_DIAG_ENABLED=true (a
 * non-secret, temporary env flag set manually in the Vercel dashboard during
 * diagnosis). It exposes ONLY non-sensitive database identity and admin
 * metadata; it never returns password_hash, passwords, DATABASE_URL, cookies,
 * tokens, API keys, or session data. The target admin email is taken from
 * AUTH_DIAG_EMAIL (admin-set env), never from request input.
 *
 * Output field names match the local diagnostic script so the two can be
 * compared directly. The fingerprint (if included) is derived only from
 * non-secret database identity metadata.
 *
 * DELETE THIS ROUTE AND UNSET AUTH_DIAG_ENABLED / AUTH_DIAG_EMAIL AFTER USE.
 */

function fingerprint(parts: (string | number | null)[]): string {
  const joined = parts.map((p) => String(p ?? "")).join("|");
  return createHash("sha256").update(joined).digest("hex");
}

export async function GET() {
  if (process.env.AUTH_DIAG_ENABLED !== "true") {
    return NextResponse.json({ status: "disabled" }, { status: 404 });
  }

  const email = (process.env.AUTH_DIAG_EMAIL ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ status: "no_diag_email" }, { status: 422 });
  }

  try {
    const [identityRows, userCountRow, superAdminsRow, adminRows] =
      await Promise.all([
        db.execute(sql`
          SELECT current_database() AS database_name,
                 current_schema()  AS schema_name,
                 version()         AS server_version
        `),
        db.select({ value: count() }).from(users),
        db
          .select({ value: count() })
          .from(users)
          .where(eq(users.role, "SUPER_ADMIN")),
        db
          .select({
            role: users.role,
            isActive: users.isActive,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
          })
          .from(users)
          .where(eq(users.email, email))
          .limit(1),
      ]);

    const identity = (identityRows as unknown as {
      rows: {
        database_name: string;
        schema_name: string;
        server_version: string;
      }[];
    }).rows[0] as {
      database_name: string;
      schema_name: string;
      server_version: string;
    };

    const usersCount = Number((userCountRow[0] as { value: string | number }).value);
    const superAdminCount = Number(
      (superAdminsRow[0] as { value: string | number }).value,
    );

    const databaseName = String(identity.database_name);
    const schemaName = String(identity.schema_name);
    const serverVersion = String(identity.server_version);
    const dbFingerprint = fingerprint([databaseName, schemaName, serverVersion]);

    const adminRowsOut = adminRows[0] ?? null;
    const admin = adminRowsOut
      ? {
          admin_exists: true,
          admin_role: String(adminRowsOut.role),
          admin_is_active: Boolean(adminRowsOut.isActive),
          admin_created_at: adminRowsOut.createdAt,
          admin_updated_at: adminRowsOut.updatedAt,
        }
      : {
          admin_exists: false,
          admin_role: null,
          admin_is_active: null,
          admin_created_at: null,
          admin_updated_at: null,
        };

    return NextResponse.json({
      database_name: databaseName,
      schema_name: schemaName,
      server_version: serverVersion,
      users_count: usersCount,
      super_admin_count: superAdminCount,
      fingerprint: dbFingerprint,
      ...admin,
    });
  } catch {
    return NextResponse.json(
      { status: "error" },
      { status: 503 },
    );
  }
}
