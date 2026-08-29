import { NextResponse } from "next/server";
import { desc, eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { organizations } from "@/db/schema/organizations";
import { organizationListQuerySchema } from "@/lib/validations/organizationQuery";
import { createOrganizationSchema } from "@/lib/validations";
import { checkApiKey } from "@/lib/auth/apiKey";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const keyCheck = checkApiKey(request);
  if (!keyCheck.ok) return jsonError(keyCheck.message, keyCheck.status);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = createOrganizationSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return jsonError(`${path}${issue.message}`, 400);
  }

  try {
    const [created] = await db
      .insert(organizations)
      .values(parsed.data)
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

    return NextResponse.json({ item: created }, { status: 201 });
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const parsed = organizationListQuerySchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    locationId: searchParams.get("locationId") ?? undefined,
    isVerified: searchParams.get("isVerified") ?? undefined,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return jsonError(`${path}${issue.message}`, 400);
  }

  const { page, limit, status, locationId, isVerified } = parsed.data;
  const offset = (page - 1) * limit;

  try {
    const conditions = [];
    if (status) {
      conditions.push(eq(organizations.status, status));
    }
    if (locationId) {
      conditions.push(eq(organizations.locationId, locationId));
    }
    if (isVerified !== undefined) {
      conditions.push(eq(organizations.isVerified, isVerified));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, items] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(organizations)
        .where(where),
      db.query.organizations.findMany({
        where,
        orderBy: [desc(organizations.createdAt)],
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
