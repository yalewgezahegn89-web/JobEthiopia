import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { professions } from "@/db/schema/professions";
import { professionIdParamSchema } from "@/lib/validations/professionQuery";
import { updateProfessionSchema } from "@/lib/validations";
import { checkApiKey } from "@/lib/auth/apiKey";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";
import { writeAuditLog } from "@/lib/auth/audit";
import { checkBodySize } from "@/lib/apiUtils";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const parsed = professionIdParamSchema.safeParse({ id });
  if (!parsed.success) {
    return jsonError("Invalid profession ID", 400);
  }

  try {
    const profession = await db.query.professions.findFirst({
      where: eq(professions.id, parsed.data.id),
    });

    if (!profession) {
      return jsonError("Profession not found", 404);
    }

    return NextResponse.json({ item: profession });
  } catch {
    return jsonError("Internal server error", 500);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const keyCheck = checkApiKey(request);
  if (!keyCheck.ok) return jsonError(keyCheck.message, keyCheck.status);

  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    return jsonError("Forbidden", 403);
  }

  const bodySizeError = checkBodySize(request);
  if (bodySizeError) return bodySizeError;

  const { id } = await params;

  const parsedId = professionIdParamSchema.safeParse({ id });
  if (!parsedId.success) {
    return jsonError("Invalid profession ID", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = updateProfessionSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return jsonError(`${path}${issue.message}`, 400);
  }

  try {
    const existing = await db.query.professions.findFirst({
      where: eq(professions.id, parsedId.data.id),
      columns: { id: true },
    });

    if (!existing) {
      return jsonError("Profession not found", 404);
    }

    const [updated] = await db
      .update(professions)
      .set(parsed.data)
      .where(eq(professions.id, parsedId.data.id))
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
      action: "PROFESSION_UPDATED",
      targetType: "profession",
      targetId: parsedId.data.id,
      metadata: { source: "api_key", fields: Object.keys(parsed.data) },
    });

    return NextResponse.json({ item: updated });
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const keyCheck = checkApiKey(request);
  if (!keyCheck.ok) return jsonError(keyCheck.message, keyCheck.status);

  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    return jsonError("Forbidden", 403);
  }

  const { id } = await params;

  const parsedId = professionIdParamSchema.safeParse({ id });
  if (!parsedId.success) {
    return jsonError("Invalid profession ID", 400);
  }

  try {
    const existing = await db.query.professions.findFirst({
      where: eq(professions.id, parsedId.data.id),
      columns: { id: true },
    });

    if (!existing) {
      return jsonError("Profession not found", 404);
    }

    await db
      .delete(professions)
      .where(eq(professions.id, parsedId.data.id));

    await writeAuditLog({
      action: "PROFESSION_DELETED",
      targetType: "profession",
      targetId: parsedId.data.id,
      metadata: { source: "api_key" },
    });

    return NextResponse.json({ success: true });
  } catch {
    return jsonError("Internal server error", 500);
  }
}
