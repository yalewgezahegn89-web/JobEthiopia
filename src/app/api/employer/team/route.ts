import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { verifySession } from "@/lib/auth/session";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";
import { checkBodySize } from "@/lib/apiUtils";
import { addEmployerTeamMemberSchema } from "@/lib/validations/employerTeam";
import {
  listEmployerTeam,
  addEmployerTeamMember,
} from "@/lib/employer/team";
import { normalizeEmail } from "@/lib/auth/login";
import { logWarn, logError, logInfo } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/requestId";

const ROUTE = "/api/employer/team";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function memberToJson(item: {
  membershipId: string;
  organizationId: string;
  organizationName: string;
  userId: string;
  name: string;
  email: string | null;
  role: string;
  isActive: boolean;
  joinedAt: Date;
}) {
  return {
    membershipId: item.membershipId,
    organizationId: item.organizationId,
    organizationName: item.organizationName,
    userId: item.userId,
    name: item.name,
    email: item.email,
    role: item.role,
    isActive: item.isActive,
    joinedAt: item.joinedAt.toISOString(),
  };
}

export async function GET() {
  const start = performance.now();
  const requestId = await getRequestId();

  const reject = (status: number, message: string, errorCode: string) => {
    logWarn("employer_team_list_failed", {
      requestId,
      route: ROUTE,
      method: "GET",
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
    const items = await listEmployerTeam(user.id);
    return NextResponse.json({ items: items.map(memberToJson) });
  } catch {
    return reject(500, "Internal server error", "INTERNAL_ERROR");
  }
}

export async function POST(request: Request) {
  const start = performance.now();
  const requestId = await getRequestId();

  const reject = (status: number, message: string, errorCode: string) => {
    logWarn("employer_team_add_failed", {
      requestId,
      route: ROUTE,
      method: "POST",
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

  const bodySizeError = checkBodySize(request);
  if (bodySizeError) return bodySizeError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return reject(400, "Invalid JSON body", "INVALID_BODY");
  }

  const parsed = addEmployerTeamMemberSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return reject(400, `${path}${issue.message}`, "VALIDATION_FAILED");
  }

  const email = normalizeEmail(parsed.data.email);

  try {
    const result = await addEmployerTeamMember(
      user.id,
      parsed.data.organizationId,
      email,
    );

    if (!result.ok) {
      switch (result.code) {
        case "ACTOR_NOT_AUTHORIZED":
          return reject(403, "Forbidden", "NOT_AUTHORIZED");
        case "ORGANIZATION_NOT_FOUND":
          return reject(404, "Organization not found", "ORGANIZATION_NOT_FOUND");
        case "ORGANIZATION_INACTIVE":
          return reject(403, "Organization is not active", "ORGANIZATION_INACTIVE");
        case "ALREADY_MEMBER":
          return reject(409, "That user is already a member", "ALREADY_MEMBER");
        case "TARGET_USER_NOT_FOUND":
        case "TARGET_USER_INACTIVE":
        case "TARGET_NOT_ORGANIZATION_ADMIN":
          return reject(
            422,
            "That user is not eligible to be added.",
            "TARGET_NOT_ELIGIBLE",
          );
        default:
          return reject(500, "Internal server error", "INTERNAL_ERROR");
      }
    }

    const durationMs = Math.round(performance.now() - start);
    logInfo("organization_member_added", {
      requestId,
      route: ROUTE,
      method: "POST",
      status: 200,
      organizationId: result.item.organizationId,
      durationMs,
    });

    return NextResponse.json({ item: memberToJson(result.item) }, { status: 201 });
  } catch {
    const durationMs = Math.round(performance.now() - start);
    logError("employer_team_add_failed", {
      requestId,
      route: ROUTE,
      method: "POST",
      status: 500,
      durationMs,
      errorCode: "INTERNAL_ERROR",
    });
    return jsonError("Internal server error", 500);
  }
}
