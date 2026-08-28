import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { locations } from "@/db/schema/locations";
import { locationIdParamSchema } from "@/lib/validations/locationQuery";
import { updateLocationSchema } from "@/lib/validations";

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

  const parsed = locationIdParamSchema.safeParse({ id });
  if (!parsed.success) {
    return jsonError("Invalid location ID", 400);
  }

  try {
    const location = await db.query.locations.findFirst({
      where: eq(locations.id, parsed.data.id),
    });

    if (!location) {
      return jsonError("Location not found", 404);
    }

    return NextResponse.json({ item: location });
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

  const parsedId = locationIdParamSchema.safeParse({ id });
  if (!parsedId.success) {
    return jsonError("Invalid location ID", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = updateLocationSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return jsonError(`${path}${issue.message}`, 400);
  }

  try {
    const existing = await db.query.locations.findFirst({
      where: eq(locations.id, parsedId.data.id),
      columns: { id: true },
    });

    if (!existing) {
      return jsonError("Location not found", 404);
    }

    const data = {
      ...parsed.data,
      latitude: parsed.data.latitude != null ? String(parsed.data.latitude) : null,
      longitude: parsed.data.longitude != null ? String(parsed.data.longitude) : null,
    };

    const [updated] = await db
      .update(locations)
      .set(data)
      .where(eq(locations.id, parsedId.data.id))
      .returning({
        id: locations.id,
        name: locations.name,
        slug: locations.slug,
        type: locations.type,
        parentId: locations.parentId,
        latitude: locations.latitude,
        longitude: locations.longitude,
        isActive: locations.isActive,
        createdAt: locations.createdAt,
        updatedAt: locations.updatedAt,
      });

    return NextResponse.json({ item: updated });
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message.includes("locations_slug_unique")
    ) {
      return jsonError("Location slug already exists", 409);
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

  const parsedId = locationIdParamSchema.safeParse({ id });
  if (!parsedId.success) {
    return jsonError("Invalid location ID", 400);
  }

  try {
    const existing = await db.query.locations.findFirst({
      where: eq(locations.id, parsedId.data.id),
      columns: { id: true },
    });

    if (!existing) {
      return jsonError("Location not found", 404);
    }

    await db
      .delete(locations)
      .where(eq(locations.id, parsedId.data.id));

    return NextResponse.json({ success: true });
  } catch {
    return jsonError("Internal server error", 500);
  }
}
