import { NextResponse } from "next/server";
import { desc, eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema/jobs";
import { jobListQuerySchema } from "@/lib/validations/jobQuery";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const parsed = jobListQuerySchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    employmentType: searchParams.get("employmentType") ?? undefined,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return jsonError(`${path}${issue.message}`, 400);
  }

  const { page, limit, status, employmentType } = parsed.data;
  const offset = (page - 1) * limit;

  try {
    const conditions = [];
    if (status) {
      conditions.push(eq(jobs.status, status));
    }
    if (employmentType) {
      conditions.push(eq(jobs.employmentType, employmentType));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, items] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(jobs)
        .where(where),
      db.query.jobs.findMany({
        where,
        orderBy: [desc(jobs.createdAt)],
        limit,
        offset,
      }),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch {
    return jsonError("Internal server error", 500);
  }
}
