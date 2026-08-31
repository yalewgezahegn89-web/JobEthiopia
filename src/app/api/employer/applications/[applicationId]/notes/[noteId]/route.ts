import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { verifySession } from "@/lib/auth/session";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";
import { checkBodySize } from "@/lib/apiUtils";
import {
  applicationNotePathSchema,
  createApplicationNoteSchema,
} from "@/lib/validations/applicationNotes";
import {
  updateApplicationNote,
  deleteApplicationNote,
  type ApplicationNote,
} from "@/lib/employer/applicationNotes";
import { logWarn, logError, logInfo } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/requestId";

const ROUTE = "/api/employer/applications/[applicationId]/notes/[noteId]";

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

function mapNoteError(
  code: string,
  reject: (status: number, message: string, errorCode: string) => Response,
) {
  switch (code) {
    case "EMPLOYER_NOT_AUTHORIZED":
      return reject(403, "Forbidden", "NOT_AUTHORIZED");
    case "ORGANIZATION_INACTIVE":
      return reject(403, "Organization is not active", "ORGANIZATION_INACTIVE");
    case "APPLICATION_NOT_FOUND":
      return reject(404, "Application not found", "APPLICATION_NOT_FOUND");
    case "NOTE_NOT_FOUND":
      return reject(404, "Note not found", "NOTE_NOT_FOUND");
    case "NOTE_NOT_OWNED":
      return reject(403, "You can only modify your own notes", "NOTE_NOT_OWNED");
    default:
      return reject(500, "Internal server error", "INTERNAL_ERROR");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ applicationId: string; noteId: string }> },
) {
  const start = performance.now();
  const requestId = await getRequestId();
  const resolved = await params;

  const reject = (status: number, message: string, errorCode: string) => {
    logWarn("application_note_update_failed", {
      requestId,
      route: ROUTE,
      method: "PATCH",
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

  const parsedParam = applicationNotePathSchema.safeParse(resolved);
  if (!parsedParam.success) {
    return reject(400, "applicationId and noteId must be valid UUIDs", "VALIDATION_FAILED");
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
    const result = await updateApplicationNote(
      user.id,
      parsedParam.data.applicationId,
      parsedParam.data.noteId,
      parsed.data.body,
    );

    if (!result.ok) {
      return mapNoteError(result.code, reject);
    }

    const durationMs = Math.round(performance.now() - start);
    logInfo("application_note_updated", {
      requestId,
      route: ROUTE,
      method: "PATCH",
      status: 200,
      applicationId: parsedParam.data.applicationId,
      noteId: parsedParam.data.noteId,
      durationMs,
    });

    return NextResponse.json({ item: noteToJson(result.item) });
  } catch {
    const durationMs = Math.round(performance.now() - start);
    logError("application_note_update_failed", {
      requestId,
      route: ROUTE,
      method: "PATCH",
      status: 500,
      durationMs,
      errorCode: "INTERNAL_ERROR",
    });
    return jsonError("Internal server error", 500);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ applicationId: string; noteId: string }> },
) {
  const start = performance.now();
  const requestId = await getRequestId();
  const resolved = await params;

  const reject = (status: number, message: string, errorCode: string) => {
    logWarn("application_note_delete_failed", {
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

  const parsedParam = applicationNotePathSchema.safeParse(resolved);
  if (!parsedParam.success) {
    return reject(400, "applicationId and noteId must be valid UUIDs", "VALIDATION_FAILED");
  }

  try {
    const result = await deleteApplicationNote(
      user.id,
      parsedParam.data.applicationId,
      parsedParam.data.noteId,
    );

    if (!result.ok) {
      return mapNoteError(result.code, reject);
    }

    const durationMs = Math.round(performance.now() - start);
    logInfo("application_note_deleted", {
      requestId,
      route: ROUTE,
      method: "DELETE",
      status: 204,
      applicationId: parsedParam.data.applicationId,
      noteId: parsedParam.data.noteId,
      durationMs,
    });

    return new NextResponse(null, { status: 204 });
  } catch {
    const durationMs = Math.round(performance.now() - start);
    logError("application_note_delete_failed", {
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
