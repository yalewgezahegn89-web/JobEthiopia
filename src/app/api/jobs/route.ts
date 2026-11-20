import { withRouteMetrics } from "@/lib/observability/routeMetrics";
import { NextResponse } from "next/server";
import { jobListQuerySchema } from "@/lib/validations/jobQuery";
import { createJobSchema } from "@/lib/validations";
import { createJobDirect } from "@/lib/ingestion/createJobDirect";
import { checkApiKey } from "@/lib/auth/apiKey";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";
import { writeAuditLog } from "@/lib/auth/audit";
import { checkBodySize } from "@/lib/apiUtils";
import { listPublicJobs } from "@/lib/jobs/listPublicJobs";
import {
  trackDiscoveryEvent,
  classifyJobListEvent,
  buildJobSearchMetadata,
} from "@/lib/analytics/events";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function __wrapped_POST(request: Request) {
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

async function __wrapped_GET(request: Request) {
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
    sort: searchParams.get("sort") ?? undefined,
    salaryMin: searchParams.get("salaryMin") ?? undefined,
    salaryMax: searchParams.get("salaryMax") ?? undefined,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return jsonError(`${path}${issue.message}`, 400);
  }

  const {
    page,
    employmentType,
    organizationId,
    categoryId,
    professionId,
    locationId,
    q,
  } = parsed.data;
  const keyword = q?.trim();

  try {
    const result = await listPublicJobs(parsed.data);
    const response = NextResponse.json(result);
    const total = result.pagination.total;

    // Best-effort discovery analytics (never impacts the response).
    try {
      const discovered = classifyJobListEvent({
        q: keyword,
        categoryId,
        professionId,
        locationId,
        employmentType,
        organizationId,
      });
      await trackDiscoveryEvent({
        event: discovered,
        metadata:
          discovered === "job_search"
            ? buildJobSearchMetadata({
                q: keyword,
                categoryId,
                professionId,
                locationId,
                employmentType,
                organizationId,
                resultCount: total,
                page,
              })
            : { page },
      });
    } catch {
      // Analytics failures are isolated and swallowed.
    }

    return response;
  } catch {
    return jsonError("Internal server error", 500);
  }
}
export const POST = withRouteMetrics("/api/jobs", "POST", __wrapped_POST);
export const GET = withRouteMetrics("/api/jobs", "GET", __wrapped_GET);
