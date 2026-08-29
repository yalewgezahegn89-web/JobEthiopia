import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sources } from "@/db/schema/sources";
import { sourceIdParamSchema } from "@/lib/validations/sourceParams";
import { updateSourceSchema } from "@/lib/validations";
import { checkApiKey } from "@/lib/auth/apiKey";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";
import { writeAuditLog } from "@/lib/auth/audit";
import { checkBodySize } from "@/lib/apiUtils";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const keyCheck = checkApiKey(request);
  if (!keyCheck.ok) return jsonError(keyCheck.message, keyCheck.status);

  const { id } = await params;

  const parsed = sourceIdParamSchema.safeParse({ id });
  if (!parsed.success) {
    return jsonError("Invalid source ID", 400);
  }

  try {
    const source = await db.query.sources.findFirst({
      where: eq(sources.id, parsed.data.id),
      columns: {
        id: true,
        name: true,
        sourceType: true,
        baseUrl: true,
        isActive: true,
        trustLevel: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!source) {
      return jsonError("Source not found", 404);
    }

    return NextResponse.json({ item: source });
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

  const parsedId = sourceIdParamSchema.safeParse({ id });
  if (!parsedId.success) {
    return jsonError("Invalid source ID", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = updateSourceSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return jsonError(`${path}${issue.message}`, 400);
  }

  try {
    const existing = await db.query.sources.findFirst({
      where: eq(sources.id, parsedId.data.id),
      columns: { id: true },
    });

    if (!existing) {
      return jsonError("Source not found", 404);
    }

    const [updated] = await db
      .update(sources)
      .set(parsed.data)
      .where(eq(sources.id, parsedId.data.id))
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
      action: "SOURCE_UPDATED",
      targetType: "source",
      targetId: parsedId.data.id,
      metadata: { source: "api_key", fields: Object.keys(parsed.data) },
    });

    return NextResponse.json({ item: updated });
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

  const parsedId = sourceIdParamSchema.safeParse({ id });
  if (!parsedId.success) {
    return jsonError("Invalid source ID", 400);
  }

  try {
    const existing = await db.query.sources.findFirst({
      where: eq(sources.id, parsedId.data.id),
      columns: { id: true },
    });

    if (!existing) {
      return jsonError("Source not found", 404);
    }

    await db
      .delete(sources)
      .where(eq(sources.id, parsedId.data.id));

    await writeAuditLog({
      action: "SOURCE_DELETED",
      targetType: "source",
      targetId: parsedId.data.id,
      metadata: { source: "api_key" },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message.includes("foreign key constraint")
    ) {
      return jsonError("Source cannot be deleted because it is referenced by other records", 409);
    }
    return jsonError("Internal server error", 500);
  }
}
