import { NextResponse } from "next/server";
import { desc, eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { locations } from "@/db/schema/locations";
import { locationListQuerySchema } from "@/lib/validations/locationQuery";
import { createLocationSchema } from "@/lib/validations";

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

  const parsed = createLocationSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return jsonError(`${path}${issue.message}`, 400);
  }

  try {
    const data = {
      ...parsed.data,
      latitude: parsed.data.latitude != null ? String(parsed.data.latitude) : null,
      longitude: parsed.data.longitude != null ? String(parsed.data.longitude) : null,
    };

    const [created] = await db
      .insert(locations)
      .values(data)
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

    return NextResponse.json({ item: created }, { status: 201 });
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const parsed = locationListQuerySchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    type: searchParams.get("type") ?? undefined,
    parentId: searchParams.get("parentId") ?? undefined,
    isActive: searchParams.get("isActive") ?? undefined,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return jsonError(`${path}${issue.message}`, 400);
  }

  const { page, limit, type, parentId, isActive } = parsed.data;
  const offset = (page - 1) * limit;

  try {
    const conditions = [];
    if (type) {
      conditions.push(eq(locations.type, type));
    }
    if (parentId) {
      conditions.push(eq(locations.parentId, parentId));
    }
    if (isActive !== undefined) {
      conditions.push(eq(locations.isActive, isActive));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, items] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(locations)
        .where(where),
      db.query.locations.findMany({
        where,
        orderBy: [desc(locations.createdAt)],
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
