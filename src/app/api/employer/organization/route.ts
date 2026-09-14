import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { verifySession } from "@/lib/auth/session";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";
import { checkBodySize } from "@/lib/apiUtils";
import { getUserOrganizationIds } from "@/lib/auth/organizationMembership";
import { updateOrganizationSettings } from "@/lib/employer/organization";
import { logInfo, logWarn, logError } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/requestId";

const ROUTE = "/api/employer/organization";

function jsonError(message: string, status: number, errorCode: string) {
  return NextResponse.json({ error: message, errorCode }, { status });
}

/**
 * PATCH /api/employer/organization
 *
 * Updates organization profile settings. Only ORGANIZATION_ADMIN users
 * who are members of the organization can update its profile.
 */
export async function PATCH(request: Request) {
  const start = performance.now();
  const requestId = await getRequestId();

  const reject = (
    status: number,
    message: string,
    errorCode: string,
    extra: Record<string, unknown> = {},
  ) => {
    logWarn("organization_update_failed", {
      requestId,
      route: ROUTE,
      method: "PATCH",
      status,
      errorCode,
      durationMs: Math.round(performance.now() - start),
      ...extra,
    });
    return jsonError(message, status, errorCode);
  };

  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE_NAME)?.value ?? "";
  if (!rawToken) return reject(401, "Unauthorized", "UNAUTHENTICATED");

  const user = await verifySession(rawToken);
  if (!user) return reject(401, "Unauthorized", "UNAUTHENTICATED");

  if (user.role !== "ORGANIZATION_ADMIN") {
    return reject(403, "Forbidden", "NOT_ORG_ADMIN");
  }

  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    return reject(403, "Forbidden", "CSRF_REJECTED");
  }

  const bodySizeError = checkBodySize(request);
  if (bodySizeError) return bodySizeError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return reject(400, "Invalid JSON body", "INVALID_BODY");
  }

  if (!body || typeof body !== "object") {
    return reject(400, "Invalid body", "INVALID_BODY");
  }

  const { organizationId, name, description, industry, websiteUrl } = body as Record<string, unknown>;

  if (!organizationId || typeof organizationId !== "string") {
    return reject(400, "organizationId is required", "VALIDATION_FAILED");
  }

  // Verify user is a member of this organization
  const orgIds = await getUserOrganizationIds(user.id);
  if (!orgIds.includes(organizationId)) {
    return reject(403, "Forbidden", "FORBIDDEN");
  }

  let result;
  try {
    result = await updateOrganizationSettings(user.id, organizationId, {
      name: typeof name === "string" ? name : undefined,
      description: typeof description === "string" ? description : null,
      industry: typeof industry === "string" ? industry : null,
      websiteUrl: typeof websiteUrl === "string" ? websiteUrl : null,
    });
  } catch {
    logError("organization_update_failed", {
      requestId,
      route: ROUTE,
      method: "PATCH",
      status: 500,
      durationMs: Math.round(performance.now() - start),
      errorCode: "INTERNAL_ERROR",
    });
    return jsonError("Internal server error", 500, "INTERNAL_ERROR");
  }

  if (!result.ok) {
    if (result.code === "NOT_FOUND") {
      return reject(404, "Organization not found", "NOT_FOUND");
    }
    if (result.code === "FORBIDDEN") {
      return reject(403, "Forbidden", "FORBIDDEN");
    }
    if (result.code === "VALIDATION") {
      return reject(422, "Invalid input", "VALIDATION_FAILED");
    }
    return reject(500, "Internal server error", "INTERNAL_ERROR");
  }

  const durationMs = Math.round(performance.now() - start);
  logInfo("organization_updated", {
    requestId,
    route: ROUTE,
    method: "PATCH",
    organizationId,
    durationMs,
  });

  return NextResponse.json({ item: result.item });
}
