import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations } from "@/db/schema/organizations";
import { organizationIdParamSchema } from "@/lib/validations/organizationQuery";
import { updateOrganizationSchema } from "@/lib/validations";

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

  const parsed = organizationIdParamSchema.safeParse({ id });
  if (!parsed.success) {
    return jsonError("Invalid organization ID", 400);
  }

  try {
    const organization = await db.query.organizations.findFirst({
      where: eq(organizations.id, parsed.data.id),
    });

    if (!organization) {
      return jsonError("Organization not found", 404);
    }

    return NextResponse.json({ item: organization });
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

  const parsedId = organizationIdParamSchema.safeParse({ id });
  if (!parsedId.success) {
    return jsonError("Invalid organization ID", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = updateOrganizationSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return jsonError(`${path}${issue.message}`, 400);
  }

  try {
    const existing = await db.query.organizations.findFirst({
      where: eq(organizations.id, parsedId.data.id),
      columns: { id: true },
    });

    if (!existing) {
      return jsonError("Organization not found", 404);
    }

    const [updated] = await db
      .update(organizations)
      .set(parsed.data)
      .where(eq(organizations.id, parsedId.data.id))
      .returning({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        description: organizations.description,
        industry: organizations.industry,
        websiteUrl: organizations.websiteUrl,
        logoUrl: organizations.logoUrl,
        locationId: organizations.locationId,
        isVerified: organizations.isVerified,
        status: organizations.status,
        createdAt: organizations.createdAt,
        updatedAt: organizations.updatedAt,
      });

    return NextResponse.json({ item: updated });
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message.includes("organizations_slug_unique")
    ) {
      return jsonError("Organization slug already exists", 409);
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

  const parsedId = organizationIdParamSchema.safeParse({ id });
  if (!parsedId.success) {
    return jsonError("Invalid organization ID", 400);
  }

  try {
    const existing = await db.query.organizations.findFirst({
      where: eq(organizations.id, parsedId.data.id),
      columns: { id: true },
    });

    if (!existing) {
      return jsonError("Organization not found", 404);
    }

    await db
      .delete(organizations)
      .where(eq(organizations.id, parsedId.data.id));

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message.includes("foreign key constraint")
    ) {
      return jsonError(
        "Organization cannot be deleted because it is referenced by other records",
        409,
      );
    }
    return jsonError("Internal server error", 500);
  }
}
