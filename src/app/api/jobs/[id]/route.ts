import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema/jobs";
import { organizations } from "@/db/schema/organizations";
import { categories } from "@/db/schema/categories";
import { professions } from "@/db/schema/professions";
import { locations } from "@/db/schema/locations";
import { jobIdParamSchema } from "@/lib/validations/jobQuery";
import { updateJobSchema } from "@/lib/validations";

type JobStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "EXPIRED" | "REMOVED";

const VALID_STATUS_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  DRAFT: ["PENDING_REVIEW", "PUBLISHED", "REMOVED"],
  PENDING_REVIEW: ["DRAFT", "PUBLISHED", "REMOVED"],
  PUBLISHED: ["EXPIRED", "REMOVED"],
  EXPIRED: ["REMOVED"],
  REMOVED: [],
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function checkApiKey(request: Request): Response | null {
  const configuredKey = process.env.INGESTION_API_KEY;

  if (!configuredKey) {
    return jsonError("Server configuration error", 500);
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

  const parsed = jobIdParamSchema.safeParse({ id });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return jsonError(`${path}${issue.message}`, 400);
  }

  try {
    const job = await db.query.jobs.findFirst({
      where: eq(jobs.id, parsed.data.id),
    });

    if (!job) {
      return jsonError("Job not found", 404);
    }

    const organizationId = job.organizationId;
    const categoryId = job.categoryId;
    const professionId = job.professionId;
    const locationId = job.locationId;

    const entityColumns = { id: true, name: true, slug: true } as const;

    const [organization, category, profession, location] = await Promise.all([
      organizationId
        ? db.query.organizations.findFirst({
            columns: entityColumns,
            where: eq(organizations.id, organizationId),
          })
        : Promise.resolve(null),
      categoryId
        ? db.query.categories.findFirst({
            columns: entityColumns,
            where: eq(categories.id, categoryId),
          })
        : Promise.resolve(null),
      professionId
        ? db.query.professions.findFirst({
            columns: entityColumns,
            where: eq(professions.id, professionId),
          })
        : Promise.resolve(null),
      locationId
        ? db.query.locations.findFirst({
            columns: entityColumns,
            where: eq(locations.id, locationId),
          })
        : Promise.resolve(null),
    ]);

    return NextResponse.json({
      item: {
        ...job,
        organization: organization ?? null,
        category: category ?? null,
        profession: profession ?? null,
        location: location ?? null,
      },
    });
  } catch {
    return jsonError("Internal server error", 500);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = checkApiKey(request);
  if (authError) return authError;

  const { id } = await params;

  const parsedId = jobIdParamSchema.safeParse({ id });
  if (!parsedId.success) {
    const issue = parsedId.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return jsonError(`${path}${issue.message}`, 400);
  }

  try {
    const existing = await db.query.jobs.findFirst({
      where: eq(jobs.id, parsedId.data.id),
      columns: { id: true },
    });

    if (!existing) {
      return jsonError("Job not found", 404);
    }

    await db
      .delete(jobs)
      .where(eq(jobs.id, parsedId.data.id));

    return NextResponse.json({ success: true });
  } catch {
    return jsonError("Internal server error", 500);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = checkApiKey(request);
  if (authError) return authError;

  const { id } = await params;

  const parsedId = jobIdParamSchema.safeParse({ id });
  if (!parsedId.success) {
    const issue = parsedId.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return jsonError(`${path}${issue.message}`, 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = updateJobSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return jsonError(`${path}${issue.message}`, 400);
  }

  try {
    const existing = await db.query.jobs.findFirst({
      where: eq(jobs.id, parsedId.data.id),
      columns: { id: true, status: true },
    });

    if (!existing) {
      return jsonError("Job not found", 404);
    }

    if (parsed.data.status !== undefined) {
      const currentStatus = existing.status as JobStatus;
      const requestedStatus = parsed.data.status;

      if (currentStatus !== requestedStatus) {
        const allowed = VALID_STATUS_TRANSITIONS[currentStatus];
        if (!allowed.includes(requestedStatus)) {
          return jsonError(
            `Invalid status transition from ${currentStatus} to ${requestedStatus}`,
            409,
          );
        }
      }
    }

    const [updated] = await db
      .update(jobs)
      .set(parsed.data)
      .where(eq(jobs.id, parsedId.data.id))
      .returning({
        id: jobs.id,
        title: jobs.title,
        slug: jobs.slug,
        status: jobs.status,
        verificationStatus: jobs.verificationStatus,
        createdAt: jobs.createdAt,
        updatedAt: jobs.updatedAt,
      });

    return NextResponse.json({ item: updated });
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message.includes("jobs_slug_unique")
    ) {
      return jsonError("Job slug already exists", 409);
    }
    return jsonError("Internal server error", 500);
  }
}
