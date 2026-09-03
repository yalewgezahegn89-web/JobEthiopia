import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

const ENABLED = process.env.AUTH_DIAG_ENABLED === "true";
const targetEmail = (process.env.AUTH_DIAG_EMAIL ?? "").trim().toLowerCase();

export async function GET() {
  if (!ENABLED) {
    return NextResponse.json({ status: "disabled" }, { status: 404 });
  }

  if (!targetEmail) {
    return NextResponse.json(
      { error: "AUTH_DIAG_EMAIL is required when AUTH_DIAG_ENABLED=true" },
      { status: 400 },
    );
  }

  try {
    const dbInfoResult = await db.execute<{
      database_name: string;
      schema_name: string;
      server_version: string;
    }>(sql`
      SELECT
        current_database() AS database_name,
        current_schema()   AS schema_name,
        version()          AS server_version
    `);
    const dbInfo = dbInfoResult.rows?.[0];

    const countsResult = await db.execute<{
      total_users: string;
      super_admin_count: string;
    }>(sql`
      SELECT
        count(*)                                           AS total_users,
        count(*) FILTER (WHERE role = 'SUPER_ADMIN')       AS super_admin_count
      FROM users
    `);
    const counts = countsResult.rows?.[0];

    const adminResult = await db.execute<{
      role: string;
      is_active: boolean;
      created_at: Date;
      updated_at: Date;
    }>(sql`
      SELECT
        role,
        is_active,
        created_at,
        updated_at
      FROM users
      WHERE lower(email) = ${targetEmail}
      LIMIT 1
    `);
    const adminRow = adminResult.rows?.[0];

    const found = Boolean(adminRow?.role);

    return NextResponse.json({
      database_name: dbInfo?.database_name ?? null,
      schema_name: dbInfo?.schema_name ?? null,
      server_version: dbInfo?.server_version ?? null,
      total_users: counts ? Number(counts.total_users) : null,
      super_admin_count: counts ? Number(counts.super_admin_count) : null,
      target_admin: {
        found,
        role: adminRow?.role ?? null,
        isActive: adminRow?.is_active ?? null,
        createdAt: adminRow?.created_at ?? null,
        updatedAt: adminRow?.updated_at ?? null,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Diagnostic query failed. View server logs for details." },
      { status: 500 },
    );
  }
}