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
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href="/admin/sources"
          className={`rounded-md px-3 py-1.5 text-sm ${
            currentIsActive === undefined && !currentSourceType
              ? "bg-neutral-900 text-white"
              : "border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
          }`}
        >
          All
        </Link>
        <Link
          href="/admin/sources?isActive=true"
          className={`rounded-md px-3 py-1.5 text-sm ${
            currentIsActive === true
              ? "bg-green-700 text-white"
              : "border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
          }`}
        >
          Active
        </Link>
        <Link
          href="/admin/sources?isActive=false"
          className={`rounded-md px-3 py-1.5 text-sm ${
            currentIsActive === false
              ? "bg-red-700 text-white"
              : "border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
          }`}
        >
          Inactive
        </Link>
        <span className="text-neutral-400">|</span>
        {SOURCE_TYPES.map((st) => (
          <Link
            key={st}
            href={`/admin/sources?sourceType=${st}${currentIsActive !== undefined ? `&isActive=${currentIsActive}` : ""}`}
            className={`rounded-md px-3 py-1.5 text-sm ${
              currentSourceType === st
                ? "bg-neutral-900 text-white"
                : "border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            {st}
          </Link>
        ))}
      </div>

      {result.items.length === 0 ? (
        <p className="mt-6 text-neutral-600">No sources found.</p>
      ) : (
        <>
          <p className="mt-4 text-sm text-neutral-500">
            {result.total} source{result.total === 1 ? "" : "s"} total
          </p>
          <ul className="mt-3 space-y-2">
            {result.items.map((source) => (
              <li key={source.id}>
                <Link
                  href={`/admin/sources/${source.id}`}
                  className="block rounded-md border border-neutral-200 p-3 hover:bg-neutral-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{source.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        source.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {source.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
                    <span>{source.sourceType}</span>
                    <span>Trust: {source.trustLevel}</span>
                    {source.baseUrl && (
                      <span className="truncate max-w-xs">{source.baseUrl}</span>
                    )}
                    {source.lastSuccessfulCheck && (
                      <span>Last check: {new Date(source.lastSuccessfulCheck).toLocaleDateString()}</span>
                    )}
                    {source.consecutiveFailures > 0 && (
                      <span className="text-red-600">
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
                    href={`/admin/sources?page=${result.page + 1}${currentIsActive !== undefined ? `&isActive=${currentIsActive}` : ""}${currentSourceType ? `&sourceType=${currentSourceType}` : ""}`}
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

      <div className="mt-6">
        <CreateSourceForm />
      </div>
    </div>
  );
}

function CreateSourceForm() {
  return (
    <details className="rounded-lg border border-neutral-200 p-4">
      <summary className="cursor-pointer text-sm font-medium text-neutral-700">
        Create new source
      </summary>
      <form action="/admin/sources/create" method="GET" className="mt-3 space-y-3">
        <p className="text-xs text-neutral-500">
          Opens the source creation form.
        </p>
      </form>
    </details>
  );
}
