import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { careerArticles } from "@/db/schema/careerArticles";
import { careerArticleIdParamSchema } from "@/lib/validations/careerArticleQuery";
import { updateCareerArticleSchema } from "@/lib/validations";

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const parsed = careerArticleIdParamSchema.safeParse({ id });
  if (!parsed.success) {
    return jsonError("Invalid career article ID", 400);
  }

  try {
    const article = await db.query.careerArticles.findFirst({
      where: eq(careerArticles.id, parsed.data.id),
    });

    if (!article) {
      return jsonError("Career article not found", 404);
    }

    return NextResponse.json({ item: article });
  } catch {
    return jsonError("Internal server error", 500);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = checkApiKey(request);
  if (authError) return authError;

  const { id } = await params;

  const parsedId = careerArticleIdParamSchema.safeParse({ id });
  if (!parsedId.success) {
    return jsonError("Invalid career article ID", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = updateCareerArticleSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return jsonError(`${path}${issue.message}`, 400);
  }

  try {
    const existing = await db.query.careerArticles.findFirst({
      where: eq(careerArticles.id, parsedId.data.id),
      columns: { id: true },
    });

    if (!existing) {
      return jsonError("Career article not found", 404);
    }

    const { publishedAt: publishedAtRaw, ...rest } = parsed.data;
    const updateData = {
      ...rest,
      ...(publishedAtRaw !== undefined && {
        publishedAt: publishedAtRaw ? new Date(publishedAtRaw) : null,
      }),
    };

    const [updated] = await db
      .update(careerArticles)
      .set(updateData)
      .where(eq(careerArticles.id, parsedId.data.id))
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

    return NextResponse.json({ item: updated });
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = checkApiKey(_request);
  if (authError) return authError;

  const { id } = await params;

  const parsedId = careerArticleIdParamSchema.safeParse({ id });
  if (!parsedId.success) {
    return jsonError("Invalid career article ID", 400);
  }

  try {
    const existing = await db.query.careerArticles.findFirst({
      where: eq(careerArticles.id, parsedId.data.id),
      columns: { id: true },
    });

    if (!existing) {
      return jsonError("Career article not found", 404);
    }

    await db
      .delete(careerArticles)
      .where(eq(careerArticles.id, parsedId.data.id));

    return NextResponse.json({ success: true });
  } catch {
    return jsonError("Internal server error", 500);
  }
}
