import { withRouteMetrics } from "@/lib/observability/routeMetrics";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLog } from "@/db/schema/auditLog";
import { sources } from "@/db/schema/sources";
import { sourceIdParamSchema } from "@/lib/validations/sourceParams";
import {
  updateSourceSchema,
  validateMergedSourceUpdate,
} from "@/lib/validations";
import { checkApiKey } from "@/lib/auth/apiKey";
import {
  API_KEY_SOURCE_ACTOR,
  authorizeSourceMutation,
  changedSourceFields,
} from "@/lib/auth/roles";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";
import { checkBodySize } from "@/lib/apiUtils";
import { isPgUniqueViolation, isPgForeignKeyViolation } from "@/lib/pgErrors";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function pickAuditFields(
  source: object,
  fields: readonly string[],
): Record<string, unknown> {
  const record = source as Record<string, unknown>;
  const picked: Record<string, unknown> = {};
  for (const field of fields) {
    picked[field] = record[field] ?? null;
  }
  return picked;
}

async function __wrapped_GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const keyCheck = checkApiKey(request);
  if (!keyCheck.ok) return jsonError(keyCheck.message, keyCheck.status);

  const { id } = await params;

  const parsed = sourceIdParamSchema.safeParse({ id });
  if (!parsed.success) {
    return jsonError("Invalid source ID", 400);
  }

  try {
    const source = await db.query.sources.findFirst({
      where: eq(sources.id, parsed.data.id),
      columns: {
        id: true,
        name: true,
        sourceType: true,
        baseUrl: true,
        isActive: true,
        trustLevel: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!source) {
      return jsonError("Source not found", 404);
    }

    return NextResponse.json({ item: source });
  } catch {
    return jsonError("Internal server error", 500);
  }
}

async function __wrapped_PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const keyCheck = checkApiKey(request);
  if (!keyCheck.ok) return jsonError(keyCheck.message, keyCheck.status);

  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    return jsonError("Forbidden", 403);
  }

  const bodySizeError = checkBodySize(request);
  if (bodySizeError) return bodySizeError;

  const { id } = await params;

  const parsedId = sourceIdParamSchema.safeParse({ id });
  if (!parsedId.success) {
    return jsonError("Invalid source ID", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = updateSourceSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return jsonError(`${path}${issue.message}`, 400);
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [current] = await tx
        .select({
          id: sources.id,
          name: sources.name,
          sourceType: sources.sourceType,
          baseUrl: sources.baseUrl,
          isActive: sources.isActive,
          trustLevel: sources.trustLevel,
          autoPublish: sources.autoPublish,
          checkFrequencyMinutes: sources.checkFrequencyMinutes,
          facebookPageId: sources.facebookPageId,
          facebookPageKind: sources.facebookPageKind,
          facebookApprovalState: sources.facebookApprovalState,
          facebookContentUseState: sources.facebookContentUseState,
          facebookAuthorizationNote: sources.facebookAuthorizationNote,
        })
        .from(sources)
        .where(eq(sources.id, parsedId.data.id))
        .limit(1)
        .for("update");

      if (!current) {
        return { status: "not_found" as const };
      }

      // The ingestion API key is a machine credential, not an admin role.
      if (
        !authorizeSourceMutation(API_KEY_SOURCE_ACTOR, {
          ...parsed.data,
          existing: current,
          operation: "update",
        }).ok
      ) {
        return { status: "forbidden" as const };
      }

      const merged = validateMergedSourceUpdate(current, parsed.data);
      if (!merged.ok) {
        return {
          status: "invalid" as const,
          message: merged.issues[0] ?? "Invalid source update",
        };
      }

      const [updated] = await tx
        .update(sources)
        .set(parsed.data)
        .where(eq(sources.id, parsedId.data.id))
        .returning({
          id: sources.id,
          name: sources.name,
          sourceType: sources.sourceType,
          baseUrl: sources.baseUrl,
          isActive: sources.isActive,
          trustLevel: sources.trustLevel,
          createdAt: sources.createdAt,
          updatedAt: sources.updatedAt,
        });

      const changedFields = changedSourceFields({ ...parsed.data, existing: current });
      await tx.insert(auditLog).values({
        actorUserId: null,
        action: "SOURCE_UPDATED",
        targetType: "source",
        targetId: parsedId.data.id,
        metadata: {
          source: "api_key",
          fields: changedFields,
          before: pickAuditFields(current, changedFields),
          after: pickAuditFields(parsed.data, changedFields),
        },
      });

      return { status: "ok" as const, updated };
    });

    if (result.status === "not_found") return jsonError("Source not found", 404);
    if (result.status === "forbidden") return jsonError("Forbidden", 403);
    if (result.status === "invalid") return jsonError(result.message, 400);

    return NextResponse.json({ item: result.updated });
  } catch (err: unknown) {
    if (isPgUniqueViolation(err, "sources_name_unique")) {
      return jsonError("Source name already exists", 409);
    }
    return jsonError("Internal server error", 500);
  }
}

async function __wrapped_DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const keyCheck = checkApiKey(request);
  if (!keyCheck.ok) return jsonError(keyCheck.message, keyCheck.status);

  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    return jsonError("Forbidden", 403);
  }

  const { id } = await params;

  const parsedId = sourceIdParamSchema.safeParse({ id });
  if (!parsedId.success) {
    return jsonError("Invalid source ID", 400);
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [current] = await tx
        .select({
          id: sources.id,
          name: sources.name,
          sourceType: sources.sourceType,
          trustLevel: sources.trustLevel,
          autoPublish: sources.autoPublish,
        })
        .from(sources)
        .where(eq(sources.id, parsedId.data.id))
        .limit(1)
        .for("update");

      if (!current) {
        return { status: "not_found" as const };
      }

      if (
        !authorizeSourceMutation(API_KEY_SOURCE_ACTOR, {
          existing: current,
          operation: "delete",
        }).ok
      ) {
        return { status: "forbidden" as const };
      }

      await tx.delete(sources).where(eq(sources.id, parsedId.data.id));

      await tx.insert(auditLog).values({
        actorUserId: null,
        action: "SOURCE_DELETED",
        targetType: "source",
        targetId: parsedId.data.id,
        metadata: {
          source: "api_key",
          before: pickAuditFields(current, [
            "name",
            "sourceType",
            "trustLevel",
            "autoPublish",
          ]),
        },
      });

      return { status: "ok" as const };
    });

    if (result.status === "not_found") return jsonError("Source not found", 404);
    if (result.status === "forbidden") return jsonError("Forbidden", 403);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (isPgForeignKeyViolation(err)) {
      return jsonError("Source cannot be deleted because it is referenced by other records", 409);
    }
    return jsonError("Internal server error", 500);
  }
}
export const GET = withRouteMetrics("/api/sources/[id]", "GET", __wrapped_GET);
export const PUT = withRouteMetrics("/api/sources/[id]", "PUT", __wrapped_PUT);
export const DELETE = withRouteMetrics("/api/sources/[id]", "DELETE", __wrapped_DELETE);
