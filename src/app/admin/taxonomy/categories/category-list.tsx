"use client";

import Link from "next/link";
import type { CategoryAdminPaginated } from "@/lib/admin/taxonomy";

export default function CategoryList({
  result,
  currentIsActive,
  currentSearch,
}: {
  result: CategoryAdminPaginated;
  currentIsActive?: boolean;
  currentSearch?: string;
}) {
  return (
    <div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/admin/taxonomy/categories"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            currentIsActive === undefined
              ? "bg-primary text-white shadow-sm"
              : "border border-border bg-surface text-muted hover:bg-surface-raised hover:text-foreground"
          }`}
        >
          All
        </Link>
        <Link
          href="/admin/taxonomy/categories?isActive=true"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            currentIsActive === true
              ? "bg-primary text-white shadow-sm"
              : "border border-border bg-surface text-muted hover:bg-surface-raised hover:text-foreground"
          }`}
        >
          Active
        </Link>
        <Link
          href="/admin/taxonomy/categories?isActive=false"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            currentIsActive === false
              ? "bg-primary text-white shadow-sm"
              : "border border-border bg-surface text-muted hover:bg-surface-raised hover:text-foreground"
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
            placeholder="Search categories..."
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          />
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Search
          </button>
        </div>
      </form>

      {result.items.length === 0 ? (
        <p className="mt-6 text-sm text-subtle">No categories found.</p>
      ) : (
        <>
          <p className="mt-4 text-sm text-muted">
            {result.total} categor{result.total === 1 ? "y" : "ies"} total
          </p>
          <ul className="mt-3 space-y-3">
            {result.items.map((cat) => (
              <li key={cat.id}>
                <article className="rounded-xl border border-border bg-surface p-5 shadow-sm transition-all duration-200 hover:border-primary/20 hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/admin/taxonomy/categories/${cat.id}`}
                      className="font-semibold text-foreground hover:text-primary"
                    >
                      {cat.name}
                    </Link>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        cat.isActive
                          ? "bg-success-light text-success"
                          : "bg-destructive-light text-destructive"
                      }`}
                    >
                      {cat.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted">
                    <span className="font-mono text-xs text-subtle">{cat.slug}</span>
                    {cat.parentName && <span>Parent: {cat.parentName}</span>}
                    {cat.childCount > 0 && (
                      <span>{cat.childCount} child{cat.childCount === 1 ? "" : "ren"}</span>
                    )}
                    {cat.jobCount > 0 && (
                      <span>{cat.jobCount} job{cat.jobCount === 1 ? "" : "s"}</span>
                    )}
                    {cat.professionCount > 0 && (
                      <span>{cat.professionCount} profession{cat.professionCount === 1 ? "" : "s"}</span>
                    )}
                    <span>Sort: {cat.sortOrder}</span>
                  </div>
                </article>
              </li>
            ))}
          </ul>

          {result.totalPages > 1 && (
            <nav className="mt-4 flex items-center justify-between">
              <div className="flex gap-1">
                {result.page > 1 && (
                  <Link
                    href={`/admin/taxonomy/categories?page=${result.page - 1}${currentIsActive !== undefined ? `&isActive=${currentIsActive}` : ""}${currentSearch ? `&search=${encodeURIComponent(currentSearch)}` : ""}`}
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
                    href={`/admin/taxonomy/categories?page=${result.page + 1}${currentIsActive !== undefined ? `&isActive=${currentIsActive}` : ""}${currentSearch ? `&search=${encodeURIComponent(currentSearch)}` : ""}`}
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
    </div>
  );
}
