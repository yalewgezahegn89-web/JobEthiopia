import { NextResponse } from "next/server";
import { desc, eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { professions } from "@/db/schema/professions";
import { professionListQuerySchema } from "@/lib/validations/professionQuery";
import { createProfessionSchema } from "@/lib/validations";
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

  const parsed = createProfessionSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return jsonError(`${path}${issue.message}`, 400);
  }

  try {
    const [created] = await db
      .insert(professions)
      .values(parsed.data)
      .returning({
        id: professions.id,
        name: professions.name,
        slug: professions.slug,
        description: professions.description,
        categoryId: professions.categoryId,
        isActive: professions.isActive,
        createdAt: professions.createdAt,
        updatedAt: professions.updatedAt,
      });

    await writeAuditLog({
      action: "PROFESSION_CREATED",
      targetType: "profession",
      targetId: created.id,
      metadata: { source: "api_key", name: created.name },
    });

    return NextResponse.json({ item: created }, { status: 201 });
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message.includes("professions_slug_unique")
    ) {
      return jsonError("Profession slug already exists", 409);
    }
    return jsonError("Internal server error", 500);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const parsed = professionListQuerySchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    categoryId: searchParams.get("categoryId") ?? undefined,
    isActive: searchParams.get("isActive") ?? undefined,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return jsonError(`${path}${issue.message}`, 400);
  }

  const { page, limit, categoryId, isActive } = parsed.data;
  const offset = (page - 1) * limit;

  try {
    const conditions = [];
    if (categoryId) {
      conditions.push(eq(professions.categoryId, categoryId));
    }
    if (isActive !== undefined) {
      conditions.push(eq(professions.isActive, isActive));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, items] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(professions)
        .where(where),
      db.query.professions.findMany({
        where,
        orderBy: [desc(professions.createdAt)],
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
