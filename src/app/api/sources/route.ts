import { NextResponse } from "next/server";
import { desc, eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { sources } from "@/db/schema/sources";
import { sourceListQuerySchema } from "@/lib/validations/sourceQuery";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const parsed = sourceListQuerySchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    isActive: searchParams.get("isActive") ?? undefined,
    sourceType: searchParams.get("sourceType") ?? undefined,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return jsonError(`${path}${issue.message}`, 400);
  }

  const { page, limit, isActive, sourceType } = parsed.data;
  const offset = (page - 1) * limit;

  try {
    const conditions = [];
    if (isActive !== undefined) {
      conditions.push(eq(sources.isActive, isActive));
    }
    if (sourceType) {
      conditions.push(eq(sources.sourceType, sourceType));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, rows] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(sources)
        .where(where),
      db
        .select({
          id: sources.id,
          name: sources.name,
          sourceType: sources.sourceType,
          baseUrl: sources.baseUrl,
          isActive: sources.isActive,
          trustLevel: sources.trustLevel,
          createdAt: sources.createdAt,
          updatedAt: sources.updatedAt,
        })
        .from(sources)
        .where(where)
        .orderBy(desc(sources.createdAt))
        .limit(limit)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      items: rows,
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
