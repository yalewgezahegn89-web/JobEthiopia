"use client";

import Link from "next/link";
import type { SourceAdminPaginated } from "@/lib/admin/sources";

const SOURCE_TYPES = ["MANUAL", "WEBSITE", "API", "FEED", "EMPLOYER", "OTHER"];

export default function SourcesList({
  result,
  currentIsActive,
  currentSourceType,
}: {
  result: SourceAdminPaginated;
  currentIsActive?: boolean;
  currentSourceType?: string;
}) {
  return (
    <div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/admin/sources"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            currentIsActive === undefined && !currentSourceType
              ? "bg-primary text-white shadow-sm"
              : "border border-border bg-surface text-muted hover:bg-surface-raised hover:text-foreground"
          }`}
        >
          All
        </Link>
        <Link
          href="/admin/sources?isActive=true"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            currentIsActive === true
              ? "bg-primary text-white shadow-sm"
              : "border border-border bg-surface text-muted hover:bg-surface-raised hover:text-foreground"
          }`}
        >
          Active
        </Link>
        <Link
          href="/admin/sources?isActive=false"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            currentIsActive === false
              ? "bg-primary text-white shadow-sm"
              : "border border-border bg-surface text-muted hover:bg-surface-raised hover:text-foreground"
          }`}
        >
          Inactive
        </Link>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {SOURCE_TYPES.map((st) => (
          <Link
            key={st}
            href={`/admin/sources?sourceType=${st}${currentIsActive !== undefined ? `&isActive=${currentIsActive}` : ""}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              currentSourceType === st
                ? "bg-primary text-white shadow-sm"
                : "border border-border bg-surface text-muted hover:bg-surface-raised hover:text-foreground"
            }`}
          >
            {st}
          </Link>
        ))}
      </div>

      {result.items.length === 0 ? (
        <p className="mt-6 text-sm text-subtle">No sources found.</p>
      ) : (
        <>
          <p className="mt-4 text-sm text-muted">
            {result.total} source{result.total === 1 ? "" : "s"} total
          </p>
          <ul className="mt-3 space-y-3">
            {result.items.map((source) => (
              <li key={source.id}>
                <Link
                  href={`/admin/sources/${source.id}`}
                  className="block rounded-xl border border-border bg-surface p-5 shadow-sm transition-all duration-200 hover:border-primary/20 hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground hover:text-primary">{source.name}</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        source.isActive
                          ? "bg-success-light text-success"
                          : "bg-destructive-light text-destructive"
                      }`}
                    >
                      {source.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                    <span className="rounded-full border border-border-subtle bg-surface-raised px-2.5 py-0.5 text-xs font-medium text-muted">
                      {source.sourceType}
                    </span>
                    <span className="text-sm text-muted">Trust: {source.trustLevel}</span>
                    {source.baseUrl && (
                      <span className="truncate max-w-xs text-xs text-subtle">{source.baseUrl}</span>
                    )}
                    {source.lastSuccessfulCheck && (
                      <span className="text-xs text-subtle">Last check: {new Date(source.lastSuccessfulCheck).toLocaleDateString()}</span>
                    )}
                    {source.consecutiveFailures > 0 && (
                      <span className="text-sm text-destructive">
                        {source.consecutiveFailures} consecutive failure{source.consecutiveFailures === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {result.totalPages > 1 && (
            <nav className="mt-4 flex items-center justify-between">
              <div className="flex gap-1">
                {result.page > 1 && (
                  <Link
                    href={`/admin/sources?page=${result.page - 1}${currentIsActive !== undefined ? `&isActive=${currentIsActive}` : ""}${currentSourceType ? `&sourceType=${currentSourceType}` : ""}`}
                    className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-muted hover:bg-surface-raised hover:text-foreground"
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
                    href={`/admin/sources?page=${result.page + 1}${currentIsActive !== undefined ? `&isActive=${currentIsActive}` : ""}${currentSourceType ? `&sourceType=${currentSourceType}` : ""}`}
                    className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-muted hover:bg-surface-raised hover:text-foreground"
                  >
                    Next
                  </Link>
                )}
              </div>
            </nav>
          )}
        </>
      )}

      <div className="mt-6">
        <Link
          href="/admin/sources/create"
          className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Create new source
        </Link>
      </div>
    </div>
  );
}
