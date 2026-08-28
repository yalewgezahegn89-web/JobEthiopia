import { NextResponse } from "next/server";
import { desc, eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema/categories";
import { categoryListQuerySchema } from "@/lib/validations/categoryQuery";
import { createCategorySchema } from "@/lib/validations";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function checkApiKey(request: Request): Response | null {
  const configuredKey = process.env.INGESTION_API_KEY;

  if (!configuredKey) {
    return jsonError("API key not configured", 500);
  }

  const providedKey = request.headers.get("x-api-key");

  if (!providedKey || providedKey !== configuredKey) {
    return jsonError("Unauthorized", 401);
  }

  return null;
}

export async function POST(request: Request) {
  const authError = checkApiKey(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return jsonError(`${path}${issue.message}`, 400);
  }

  try {
    const [created] = await db
      .insert(categories)
      .values(parsed.data)
      .returning({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        description: categories.description,
        parentId: categories.parentId,
        isActive: categories.isActive,
        sortOrder: categories.sortOrder,
        createdAt: categories.createdAt,
        updatedAt: categories.updatedAt,
      });

    return NextResponse.json({ item: created }, { status: 201 });
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message.includes("categories_slug_unique")
    ) {
      return jsonError("Category slug already exists", 409);
    }
    return jsonError("Internal server error", 500);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const parsed = categoryListQuerySchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    parentId: searchParams.get("parentId") ?? undefined,
    isActive: searchParams.get("isActive") ?? undefined,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return jsonError(`${path}${issue.message}`, 400);
  }

  const { page, limit, parentId, isActive } = parsed.data;
  const offset = (page - 1) * limit;

  try {
    const conditions = [];
    if (parentId) {
      conditions.push(eq(categories.parentId, parentId));
    }
    if (isActive !== undefined) {
      conditions.push(eq(categories.isActive, isActive));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, items] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(categories)
        .where(where),
      db.query.categories.findMany({
        where,
        orderBy: [desc(categories.createdAt)],
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
