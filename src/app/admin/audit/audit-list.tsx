"use client";

import Link from "next/link";
import type { AuditLogPaginated } from "@/lib/admin/audit";

const ACTIONS = [
  "LOGIN_SUCCESS",
  "LOGIN_FAILURE",
  "LOGOUT",
  "BOOTSTRAP_ADMIN",
  "PASSWORD_CHANGED",
  "PASSWORD_RESET_REQUESTED",
  "PASSWORD_RESET_COMPLETED",
  "USER_ACTIVATED",
  "USER_DEACTIVATED",
  "USER_SESSIONS_REVOKED",
  "USER_ROLE_CHANGED",
  "SOURCE_CREATED",
  "SOURCE_UPDATED",
  "SOURCE_DELETED",
  "SOURCE_ACTIVATED",
  "SOURCE_DEACTIVATED",
  "SOURCE_HEALTH_CHECKED",
  "ORGANIZATION_CREATED",
  "ORGANIZATION_UPDATED",
  "ORGANIZATION_DELETED",
  "ORGANIZATION_VERIFIED",
  "ORGANIZATION_REJECTED",
  "ORGANIZATION_REVIEW_REQUESTED",
  "JOB_CREATED",
  "JOB_UPDATED",
  "JOB_DELETED",
  "JOB_PUBLISHED",
  "JOB_REJECTED",
  "JOB_MARKED_INVALID",
  "JOB_REVIEW_REQUESTED",
  "JOB_AUTO_EXPIRED",
  "JOB_INGESTED",
  "CATEGORY_CREATED",
  "CATEGORY_UPDATED",
  "CATEGORY_DELETED",
  "LOCATION_CREATED",
  "LOCATION_UPDATED",
  "LOCATION_DELETED",
  "PROFESSION_CREATED",
  "PROFESSION_UPDATED",
  "PROFESSION_DELETED",
  "CAREER_ARTICLE_CREATED",
  "CAREER_ARTICLE_UPDATED",
  "CAREER_ARTICLE_DELETED",
  "APPLICATION_SUBMITTED",
  "APPLICATION_WITHDRAWN",
  "APPLICATION_STATUS_CHANGED",
  "ORGANIZATION_MEMBER_ADDED",
  "ORGANIZATION_MEMBER_REMOVED",
  "APPLICATION_NOTE_CREATED",
  "APPLICATION_NOTE_UPDATED",
  "APPLICATION_NOTE_DELETED",
  "RESUME_UPLOADED",
  "RESUME_REPLACED",
  "RESUME_DELETED",
  "MAINTENANCE_RUN",
] as const;

const TARGET_TYPES = [
  "user",
  "job",
  "source",
  "organization",
  "category",
  "location",
  "profession",
  "career_article",
  "application",
  "organization_member",
  "application_note",
  "maintenance",
] as const;

const TARGET_LINKS: Record<string, (id: string) => string> = {
  user: (id) => `/admin/users/${id}`,
  job: (id) => `/admin/jobs/${id}`,
  source: (id) => `/admin/sources/${id}`,
  organization: (id) => `/admin/organizations/${id}`,
};

function buildQuery(
  page: number,
  action?: string,
  targetType?: string,
  actorUserId?: string,
) {
  const parts: string[] = [`page=${page}`];
  if (action) parts.push(`action=${encodeURIComponent(action)}`);
  if (targetType) parts.push(`targetType=${encodeURIComponent(targetType)}`);
  if (actorUserId) parts.push(`actorUserId=${encodeURIComponent(actorUserId)}`);
  return `?${parts.join("&")}`;
}

function formatAction(action: string) {
  return action
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AuditList({
  result,
  currentAction,
  currentTargetType,
  currentActorUserId,
}: {
  result: AuditLogPaginated;
  currentAction?: string;
  currentTargetType?: string;
  currentActorUserId?: string;
}) {
  const hasFilters = currentAction || currentTargetType || currentActorUserId;

  const FOCUS_RING =
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

  return (
    <div>
      <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">Action</span>
          <select
            name="action"
            defaultValue={currentAction ?? ""}
            className={`rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground ${FOCUS_RING}`}
          >
            <option value="">All actions</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {formatAction(a)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">Target type</span>
          <select
            name="targetType"
            defaultValue={currentTargetType ?? ""}
            className={`rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground ${FOCUS_RING}`}
          >
            <option value="">All types</option>
            {TARGET_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        {currentActorUserId && (
          <input type="hidden" name="actorUserId" value={currentActorUserId} />
        )}
        <button
          type="submit"
          className={`rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover hover:shadow-md ${FOCUS_RING}`}
        >
          Filter
        </button>
        {hasFilters && (
          <Link
            href="/admin/audit"
            className={`rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-muted shadow-sm hover:bg-surface-raised hover:text-foreground ${FOCUS_RING}`}
          >
            Clear filters
          </Link>
        )}
      </form>

      {result.items.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center">
          <p className="text-sm text-muted">No audit events found.</p>
        </div>
      ) : (
        <>
          <p className="mt-4 text-sm text-muted">
            {result.total} event{result.total === 1 ? "" : "s"} total
          </p>
          <ul className="mt-3 space-y-3 text-sm">
            {result.items.map((entry) => {
              const link =
                entry.targetType &&
                entry.targetId &&
                TARGET_LINKS[entry.targetType]
                  ? TARGET_LINKS[entry.targetType](entry.targetId)
                  : null;

              return (
                <li
                  key={entry.id}
                  className="rounded-lg border border-border bg-surface p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {entry.action}
                        </span>
                        <span className="text-xs text-subtle">
                          {new Date(entry.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted">
                        by {entry.actorEmail ?? "system"}
                        {entry.targetType && (
                          <>
                            {" · "}
                            {link ? (
                              <Link href={link} className="underline hover:text-primary">
                                {entry.targetType}
                              </Link>
                            ) : (
                              <span>{entry.targetType}</span>
                            )}
                            {entry.targetId && (
                              <span className="ml-1 font-mono text-subtle">
                                {entry.targetId.slice(0, 8)}…
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {entry.metadata &&
                  typeof entry.metadata === "object" &&
                  Object.keys(entry.metadata).length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                      {Object.entries(
                        entry.metadata as Record<string, unknown>,
                      ).map(([key, value]) => (
                        <span key={key}>
                          <span className="text-subtle">{key}:</span>{" "}
                          {typeof value === "boolean"
                            ? value
                              ? "yes"
                              : "no"
                            : String(value ?? "–")}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {result.totalPages > 1 && (
            <nav className="mt-4 flex flex-wrap items-center justify-between gap-3" aria-label="Audit log pagination">
              <div className="flex gap-1">
                {result.page > 1 && (
                  <Link
                    href={buildQuery(
                      result.page - 1,
                      currentAction,
                      currentTargetType,
                      currentActorUserId,
                    )}
                    className={`rounded-lg border border-border bg-surface px-4 py-2 font-semibold text-foreground shadow-sm hover:bg-surface-raised hover:shadow-md ${FOCUS_RING}`}
                  >
                    Previous
                  </Link>
                )}
              </div>
              <span className="text-sm text-muted">
                Page {result.page} of {result.totalPages}
              </span>
              <div className="flex gap-1">
                {result.page < result.totalPages && (
                  <Link
                    href={buildQuery(
                      result.page + 1,
                      currentAction,
                      currentTargetType,
                      currentActorUserId,
                    )}
                    className={`rounded-lg border border-border bg-surface px-4 py-2 font-semibold text-foreground shadow-sm hover:bg-surface-raised hover:shadow-md ${FOCUS_RING}`}
                  >
                    Next
                  </Link>
                )}
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
