import { NextResponse } from "next/server";
import { desc, eq, and, or, ilike, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema/jobs";
import { organizations } from "@/db/schema/organizations";
import { categories } from "@/db/schema/categories";
import { professions } from "@/db/schema/professions";
import { locations } from "@/db/schema/locations";
import { jobListQuerySchema } from "@/lib/validations/jobQuery";
import { createJobSchema } from "@/lib/validations";
import { createJobDirect } from "@/lib/ingestion/createJobDirect";
import { checkApiKey } from "@/lib/auth/apiKey";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";
import { writeAuditLog } from "@/lib/auth/audit";
import { checkBodySize, escapeLikePattern } from "@/lib/apiUtils";

function toEntityMap<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.id, row]));
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const keyCheck = checkApiKey(request);
  if (!keyCheck.ok) return jsonError(keyCheck.message, keyCheck.status);

  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    return jsonError("Forbidden", 403);
  }

  const bodySizeError = checkBodySize(request);
  if (bodySizeError) return bodySizeError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = createJobSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return jsonError(`${path}${issue.message}`, 400);
  }

  const organizationId = process.env.INGESTION_ORGANIZATION_ID;
  if (!organizationId) {
    return jsonError("Server configuration error", 500);
  }

  try {
    const created = await createJobDirect(parsed.data, { organizationId });

    await writeAuditLog({
      action: "JOB_CREATED",
      targetType: "job",
      targetId: created.id,
      metadata: { source: "api_key" },
    });

    return NextResponse.json({ item: created }, { status: 201 });
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message.includes("Could not create job with unique slug")
    ) {
      return jsonError("Job slug already exists", 409);
    }
    return jsonError("Internal server error", 500);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const parsed = jobListQuerySchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    employmentType: searchParams.get("employmentType") ?? undefined,
    organizationId: searchParams.get("organizationId") ?? undefined,
    categoryId: searchParams.get("categoryId") ?? undefined,
    professionId: searchParams.get("professionId") ?? undefined,
    locationId: searchParams.get("locationId") ?? undefined,
    q: searchParams.get("q") ?? undefined,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return jsonError(`${path}${issue.message}`, 400);
  }

  const {
    page,
    limit,
    employmentType,
    organizationId,
    categoryId,
    professionId,
    locationId,
    q,
  } = parsed.data;
  const offset = (page - 1) * limit;

  try {
    const keyword = q?.trim();

    let organizationNameIds: string[] = [];
    if (keyword) {
      const escapedKeyword = escapeLikePattern(keyword);
      const matches = await db.query.organizations.findMany({
        columns: { id: true },
        where: ilike(organizations.name, `%${escapedKeyword}%`),
      });
      organizationNameIds = matches.map((match) => match.id);
    }

    const conditions: (SQL | undefined)[] = [eq(jobs.status, "PUBLISHED")];
    if (employmentType) {
      conditions.push(eq(jobs.employmentType, employmentType));
    }
    if (organizationId) {
      conditions.push(eq(jobs.organizationId, organizationId));
    }
    if (categoryId) {
      conditions.push(eq(jobs.categoryId, categoryId));
    }
    if (professionId) {
      conditions.push(eq(jobs.professionId, professionId));
    }
    if (locationId) {
      conditions.push(eq(jobs.locationId, locationId));
    }
    if (keyword) {
      const escapedKeyword = escapeLikePattern(keyword);
      const pattern = `%${escapedKeyword}%`;
      const titleOrDescription = or(
        ilike(jobs.title, pattern),
        ilike(jobs.description, pattern),
      );
      if (organizationNameIds.length > 0) {
        conditions.push(
          or(
            titleOrDescription,
            inArray(jobs.organizationId, organizationNameIds),
          ),
        );
      } else {
        conditions.push(titleOrDescription);
      }
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, rows] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(jobs)
        .where(where),
      db.query.jobs.findMany({
        where,
        orderBy: [desc(jobs.createdAt)],
        limit,
        offset,
      }),
    ]);

    const organizationIds = [
      ...new Set(
        rows
          .map((row) => row.organizationId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const categoryIds = [
      ...new Set(
        rows
          .map((row) => row.categoryId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const professionIds = [
      ...new Set(
        rows
          .map((row) => row.professionId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const locationIds = [
      ...new Set(
        rows
          .map((row) => row.locationId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const entityColumns = { id: true, name: true, slug: true } as const;

    const [organizationRows, categoryRows, professionRows, locationRows] =
      await Promise.all([
        organizationIds.length > 0
          ? db.query.organizations.findMany({
              columns: entityColumns,
              where: inArray(organizations.id, organizationIds),
            })
          : Promise.resolve([] as { id: string }[]),
        categoryIds.length > 0
          ? db.query.categories.findMany({
              columns: entityColumns,
              where: inArray(categories.id, categoryIds),
            })
          : Promise.resolve([] as { id: string }[]),
        professionIds.length > 0
          ? db.query.professions.findMany({
              columns: entityColumns,
              where: inArray(professions.id, professionIds),
            })
          : Promise.resolve([] as { id: string }[]),
        locationIds.length > 0
          ? db.query.locations.findMany({
              columns: entityColumns,
              where: inArray(locations.id, locationIds),
            })
          : Promise.resolve([] as { id: string }[]),
      ]);

    const organizationMap = toEntityMap(organizationRows);
    const categoryMap = toEntityMap(categoryRows);
    const professionMap = toEntityMap(professionRows);
    const locationMap = toEntityMap(locationRows);

    const items = rows.map((row) => ({
      ...row,
      organization: row.organizationId
        ? organizationMap.get(row.organizationId) ?? null
        : null,
      category: row.categoryId ? categoryMap.get(row.categoryId) ?? null : null,
      profession: row.professionId
        ? professionMap.get(row.professionId) ?? null
        : null,
      location: row.locationId ? locationMap.get(row.locationId) ?? null : null,
    }));

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
