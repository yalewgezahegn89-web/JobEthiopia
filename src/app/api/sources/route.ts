import { NextResponse } from "next/server";
import { desc, eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { sources } from "@/db/schema/sources";
import { sourceListQuerySchema } from "@/lib/validations/sourceQuery";
import { createSourceSchema } from "@/lib/validations";
import { checkApiKey } from "@/lib/auth/apiKey";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";
import { writeAuditLog } from "@/lib/auth/audit";
import { checkBodySize } from "@/lib/apiUtils";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const keyCheck = checkApiKey(request);
  if (!keyCheck.ok) return jsonError(keyCheck.message, keyCheck.status);

  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    return jsonError("Forbidden", 403);
  }

  const bodySizeError = checkBodySize(request);
  if (bodySizeError) return bodySizeError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = createSourceSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return jsonError(`${path}${issue.message}`, 400);
  }

  try {
    const [created] = await db
      .insert(sources)
      .values(parsed.data)
      .returning({
        id: sources.id,
        name: sources.name,
        sourceType: sources.sourceType,
        baseUrl: sources.baseUrl,
        isActive: sources.isActive,
        trustLevel: sources.trustLevel,
        createdAt: sources.createdAt,
        updatedAt: sources.updatedAt,
      });

    await writeAuditLog({
      action: "SOURCE_CREATED",
      targetType: "source",
      targetId: created.id,
      metadata: { source: "api_key", name: created.name },
    });

    return NextResponse.json({ item: created }, { status: 201 });
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message.includes("sources_name_unique")
    ) {
      return jsonError("Source name already exists", 409);
    }
    return jsonError("Internal server error", 500);
  }
}

export async function GET(request: Request) {
  const keyCheck = checkApiKey(request);
  if (!keyCheck.ok) return jsonError(keyCheck.message, keyCheck.status);

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
