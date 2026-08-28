import { NextResponse } from "next/server";
import { desc, eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { careerArticles } from "@/db/schema/careerArticles";
import { careerArticleListQuerySchema } from "@/lib/validations/careerArticleQuery";
import { createCareerArticleSchema } from "@/lib/validations";

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

  const parsed = createCareerArticleSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return jsonError(`${path}${issue.message}`, 400);
  }

  try {
    const { publishedAt: publishedAtRaw, ...rest } = parsed.data;
    const insertData = {
      ...rest,
      ...(publishedAtRaw !== undefined && {
        publishedAt: publishedAtRaw ? new Date(publishedAtRaw) : null,
      }),
    };

    const [created] = await db
      .insert(careerArticles)
      .values(insertData)
      .returning({
        id: careerArticles.id,
        title: careerArticles.title,
        slug: careerArticles.slug,
        excerpt: careerArticles.excerpt,
        content: careerArticles.content,
        category: careerArticles.category,
        status: careerArticles.status,
        publishedAt: careerArticles.publishedAt,
        createdAt: careerArticles.createdAt,
        updatedAt: careerArticles.updatedAt,
      });

    return NextResponse.json({ item: created }, { status: 201 });
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message.includes("career_articles_slug_unique")
    ) {
      return jsonError("Career article slug already exists", 409);
    }
    return jsonError("Internal server error", 500);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const parsed = careerArticleListQuerySchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    category: searchParams.get("category") ?? undefined,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return jsonError(`${path}${issue.message}`, 400);
  }

  const { page, limit, status, category } = parsed.data;
  const offset = (page - 1) * limit;

  try {
    const conditions = [];
    if (status) {
      conditions.push(eq(careerArticles.status, status));
    }
    if (category) {
      conditions.push(eq(careerArticles.category, category));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, items] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(careerArticles)
        .where(where),
      db.query.careerArticles.findMany({
        where,
        orderBy: [desc(careerArticles.createdAt)],
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
