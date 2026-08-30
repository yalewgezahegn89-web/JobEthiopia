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

  return (
    <div>
      <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Action
          <select
            name="action"
            defaultValue={currentAction ?? ""}
            className="rounded-md border border-neutral-300 px-2 py-1"
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
          Target type
          <select
            name="targetType"
            defaultValue={currentTargetType ?? ""}
            className="rounded-md border border-neutral-300 px-2 py-1"
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
          className="rounded-md border border-neutral-300 px-3 py-1 text-sm"
        >
          Filter
        </button>
        {hasFilters && (
          <Link
            href="/admin/audit"
            className="rounded-md border border-neutral-300 px-3 py-1 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            Clear filters
          </Link>
        )}
      </form>

      {result.items.length === 0 ? (
        <p className="mt-6 text-neutral-600">No audit events found.</p>
      ) : (
        <>
          <p className="mt-4 text-sm text-neutral-500">
            {result.total} event{result.total === 1 ? "" : "s"} total
          </p>
          <ul className="mt-3 space-y-2 text-sm">
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
                  className="rounded-md border border-neutral-200 p-3"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{entry.action}</span>
                        <span className="text-xs text-neutral-500">
                          {new Date(entry.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-neutral-500">
                        by {entry.actorEmail ?? "system"}
                        {entry.targetType && (
                          <>
                            {" · "}
                            {link ? (
                              <Link href={link} className="underline">
                                {entry.targetType}
                              </Link>
                            ) : (
                              <span>{entry.targetType}</span>
                            )}
                            {entry.targetId && (
                              <span className="ml-1 font-mono text-neutral-400">
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
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
                      {Object.entries(
                        entry.metadata as Record<string, unknown>,
                      ).map(([key, value]) => (
                        <span key={key}>
                          <span className="text-neutral-400">{key}:</span>{" "}
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
            <nav className="mt-4 flex items-center justify-between">
              <div className="flex gap-1">
                {result.page > 1 && (
                  <Link
                    href={buildQuery(
                      result.page - 1,
                      currentAction,
                      currentTargetType,
                      currentActorUserId,
                    )}
                    className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
                  >
                    Previous
                  </Link>
                )}
              </div>
              <span className="text-sm text-neutral-500">
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
                    className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
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
