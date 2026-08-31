import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { verifySession } from "@/lib/auth/session";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";
import { checkBodySize } from "@/lib/apiUtils";
import { applicationNoteIdParamSchema, createApplicationNoteSchema } from "@/lib/validations/applicationNotes";
import {
  listApplicationNotes,
  createApplicationNote,
  type ApplicationNote,
} from "@/lib/employer/applicationNotes";
import { logWarn, logError, logInfo } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/requestId";

const ROUTE = "/api/employer/applications/[applicationId]/notes";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function noteToJson(item: ApplicationNote) {
  return {
    id: item.id,
    applicationId: item.applicationId,
    authorUserId: item.authorUserId,
    authorName: item.authorName,
    authorActive: item.authorActive,
    body: item.body,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ applicationId: string }> },
) {
  const start = performance.now();
  const requestId = await getRequestId();
  const resolved = await params;
  const applicationId = resolved.applicationId;

  const reject = (status: number, message: string, errorCode: string) => {
    logWarn("application_note_list_failed", {
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

  const parsed = applicationNoteIdParamSchema.safeParse({ applicationId });
  if (!parsed.success) {
    return reject(400, "applicationId must be a valid UUID", "VALIDATION_FAILED");
  }

  try {
    const result = await listApplicationNotes(user.id, applicationId);
    if (!result.ok) {
      if (result.code === "EMPLOYER_NOT_AUTHORIZED") {
        return reject(403, "Forbidden", "NOT_AUTHORIZED");
      }
      if (result.code === "ORGANIZATION_INACTIVE") {
        return reject(403, "Organization is not active", "ORGANIZATION_INACTIVE");
      }
      return reject(404, "Application not found", "APPLICATION_NOT_FOUND");
    }
    return NextResponse.json({ items: result.item.map(noteToJson) });
  } catch {
    return reject(500, "Internal server error", "INTERNAL_ERROR");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ applicationId: string }> },
) {
  const start = performance.now();
  const requestId = await getRequestId();
  const resolved = await params;
  const applicationId = resolved.applicationId;

  const reject = (status: number, message: string, errorCode: string) => {
    logWarn("application_note_create_failed", {
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

  const parsedParam = applicationNoteIdParamSchema.safeParse({ applicationId });
  if (!parsedParam.success) {
    return reject(400, "applicationId must be a valid UUID", "VALIDATION_FAILED");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return reject(400, "Invalid JSON body", "INVALID_BODY");
  }

  const parsed = createApplicationNoteSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return reject(400, `${path}${issue.message}`, "VALIDATION_FAILED");
  }

  try {
    const result = await createApplicationNote(
      user.id,
      applicationId,
      parsed.data.body,
    );

    if (!result.ok) {
      if (result.code === "EMPLOYER_NOT_AUTHORIZED") {
        return reject(403, "Forbidden", "NOT_AUTHORIZED");
      }
      if (result.code === "ORGANIZATION_INACTIVE") {
        return reject(403, "Organization is not active", "ORGANIZATION_INACTIVE");
      }
      if (result.code === "APPLICATION_NOT_FOUND") {
        return reject(404, "Application not found", "APPLICATION_NOT_FOUND");
      }
      return reject(500, "Internal server error", "INTERNAL_ERROR");
    }

    const durationMs = Math.round(performance.now() - start);
    logInfo("application_note_created", {
      requestId,
      route: ROUTE,
      method: "POST",
      status: 201,
      applicationId,
      noteId: result.item.id,
      durationMs,
    });

    return NextResponse.json({ item: noteToJson(result.item) }, { status: 201 });
  } catch {
    const durationMs = Math.round(performance.now() - start);
    logError("application_note_create_failed", {
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
