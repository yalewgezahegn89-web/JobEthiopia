import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { verifySession } from "@/lib/auth/session";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";
import { employerTeamMembershipIdParamSchema } from "@/lib/validations/employerTeam";
import {
  removeEmployerTeamMember,
  resolveEmployerTeamMembership,
} from "@/lib/employer/team";
import { logWarn, logError, logInfo } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/requestId";

const ROUTE = "/api/employer/team/[membershipId]";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ membershipId: string }> },
) {
  const start = performance.now();
  const requestId = await getRequestId();
  const resolvedParams = await params;
  const membershipId = resolvedParams.membershipId;

  const reject = (status: number, message: string, errorCode: string) => {
    logWarn("employer_team_remove_failed", {
      requestId,
      route: ROUTE,
      method: "DELETE",
      status,
      errorCode,
      durationMs: Math.round(performance.now() - start),
    });
    return jsonError(message, status);
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

  const parsed = employerTeamMembershipIdParamSchema.safeParse({
    membershipId,
  });
  if (!parsed.success) {
    return reject(400, "membershipId must be a valid UUID", "VALIDATION_FAILED");
  }

  try {
    // Authorize from the membership's stored organization, never a client id.
    const membership = await resolveEmployerTeamMembership(membershipId);
    if (!membership) {
      return reject(404, "Membership not found", "MEMBERSHIP_NOT_FOUND");
    }

    const result = await removeEmployerTeamMember(
      user.id,
      membership.organizationId,
      membership.targetUserId,
    );

    if (!result.ok) {
      switch (result.code) {
        case "ACTOR_NOT_AUTHORIZED":
          return reject(403, "Forbidden", "NOT_AUTHORIZED");
        case "ORGANIZATION_NOT_FOUND":
          return reject(404, "Organization not found", "ORGANIZATION_NOT_FOUND");
        case "ORGANIZATION_INACTIVE":
          return reject(403, "Organization is not active", "ORGANIZATION_INACTIVE");
        case "MEMBERSHIP_NOT_FOUND":
          return reject(404, "Membership not found", "MEMBERSHIP_NOT_FOUND");
        case "LAST_ADMIN":
          return reject(
            409,
            "An organization must have at least one active administrator.",
            "LAST_ADMIN",
          );
        default:
          return reject(500, "Internal server error", "INTERNAL_ERROR");
      }
    }

    const durationMs = Math.round(performance.now() - start);
    logInfo("organization_member_removed", {
      requestId,
      route: ROUTE,
      method: "DELETE",
      status: 204,
      organizationId: membership.organizationId,
      durationMs,
    });

    return new NextResponse(null, { status: 204 });
  } catch {
    const durationMs = Math.round(performance.now() - start);
    logError("employer_team_remove_failed", {
      requestId,
      route: ROUTE,
      method: "DELETE",
      status: 500,
      durationMs,
      errorCode: "INTERNAL_ERROR",
    });
    return jsonError("Internal server error", 500);
  }
}
