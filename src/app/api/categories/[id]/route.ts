import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema/categories";
import { categoryIdParamSchema } from "@/lib/validations/categoryQuery";
import { updateCategorySchema } from "@/lib/validations";

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

  const parsed = categoryIdParamSchema.safeParse({ id });
  if (!parsed.success) {
    return jsonError("Invalid category ID", 400);
  }

  try {
    const category = await db.query.categories.findFirst({
      where: eq(categories.id, parsed.data.id),
    });

    if (!category) {
      return jsonError("Category not found", 404);
    }

    return NextResponse.json({ item: category });
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

  const parsedId = categoryIdParamSchema.safeParse({ id });
  if (!parsedId.success) {
    return jsonError("Invalid category ID", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = updateCategorySchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return jsonError(`${path}${issue.message}`, 400);
  }

  try {
    const existing = await db.query.categories.findFirst({
      where: eq(categories.id, parsedId.data.id),
      columns: { id: true },
    });

    if (!existing) {
      return jsonError("Category not found", 404);
    }

    const [updated] = await db
      .update(categories)
      .set(parsed.data)
      .where(eq(categories.id, parsedId.data.id))
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

    return NextResponse.json({ item: updated });
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = checkApiKey(_request);
  if (authError) return authError;

  const { id } = await params;

  const parsedId = categoryIdParamSchema.safeParse({ id });
  if (!parsedId.success) {
    return jsonError("Invalid category ID", 400);
  }

  try {
    const existing = await db.query.categories.findFirst({
      where: eq(categories.id, parsedId.data.id),
      columns: { id: true },
    });

    if (!existing) {
      return jsonError("Category not found", 404);
    }

    await db
      .delete(categories)
      .where(eq(categories.id, parsedId.data.id));

    return NextResponse.json({ success: true });
  } catch {
    return jsonError("Internal server error", 500);
  }
}
