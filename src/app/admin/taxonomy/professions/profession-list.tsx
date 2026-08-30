"use client";

import Link from "next/link";
import type { ProfessionAdminPaginated } from "@/lib/admin/taxonomy";

export default function ProfessionList({
  result,
  currentIsActive,
  currentCategoryId,
  currentSearch,
}: {
  result: ProfessionAdminPaginated;
  currentIsActive?: boolean;
  currentCategoryId?: string;
  currentSearch?: string;
}) {
  return (
    <div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href="/admin/taxonomy/professions"
          className={`rounded-md px-3 py-1.5 text-sm ${
            currentIsActive === undefined
              ? "bg-neutral-900 text-white"
              : "border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
          }`}
        >
          All
        </Link>
        <Link
          href="/admin/taxonomy/professions?isActive=true"
          className={`rounded-md px-3 py-1.5 text-sm ${
            currentIsActive === true
              ? "bg-green-700 text-white"
              : "border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
          }`}
        >
          Active
        </Link>
        <Link
          href="/admin/taxonomy/professions?isActive=false"
          className={`rounded-md px-3 py-1.5 text-sm ${
            currentIsActive === false
              ? "bg-red-700 text-white"
              : "border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
          }`}
        >
          Inactive
        </Link>
      </div>

      <form className="mt-3" method="get">
        {currentIsActive !== undefined && (
          <input type="hidden" name="isActive" value={String(currentIsActive)} />
        )}
        <div className="flex gap-2">
          <input
            type="text"
            name="search"
            defaultValue={currentSearch ?? ""}
            placeholder="Search professions..."
            className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            Search
          </button>
        </div>
      </form>

      {result.items.length === 0 ? (
        <p className="mt-6 text-neutral-600">No professions found.</p>
      ) : (
        <>
          <p className="mt-4 text-sm text-neutral-500">
            {result.total} profession{result.total === 1 ? "" : "s"} total
          </p>
          <ul className="mt-3 space-y-2">
            {result.items.map((prof) => (
              <li key={prof.id}>
                <Link
                  href={`/admin/taxonomy/professions/${prof.id}`}
                  className="block rounded-md border border-neutral-200 p-3 hover:bg-neutral-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{prof.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        prof.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {prof.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
                    <span className="font-mono">{prof.slug}</span>
                    {prof.categoryName && <span>Category: {prof.categoryName}</span>}
                    {prof.jobCount > 0 && (
                      <span>{prof.jobCount} job{prof.jobCount === 1 ? "" : "s"}</span>
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
                    href={`/admin/taxonomy/professions?page=${result.page - 1}${currentIsActive !== undefined ? `&isActive=${currentIsActive}` : ""}${currentCategoryId ? `&categoryId=${currentCategoryId}` : ""}${currentSearch ? `&search=${encodeURIComponent(currentSearch)}` : ""}`}
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
                    href={`/admin/taxonomy/professions?page=${result.page + 1}${currentIsActive !== undefined ? `&isActive=${currentIsActive}` : ""}${currentCategoryId ? `&categoryId=${currentCategoryId}` : ""}${currentSearch ? `&search=${encodeURIComponent(currentSearch)}` : ""}`}
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
