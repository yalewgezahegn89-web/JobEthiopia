"use client";

import Link from "next/link";
import type { LocationAdminPaginated } from "@/lib/admin/taxonomy";

const LOCATION_TYPES = ["COUNTRY", "REGION", "CITY", "DISTRICT", "OTHER"];

export default function LocationList({
  result,
  currentIsActive,
  currentType,
  currentSearch,
}: {
  result: LocationAdminPaginated;
  currentIsActive?: boolean;
  currentType?: string;
  currentSearch?: string;
}) {
  return (
    <div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/admin/taxonomy/locations"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            currentIsActive === undefined && !currentType
              ? "bg-primary text-white shadow-sm"
              : "border border-border bg-surface text-muted hover:bg-surface-raised hover:text-foreground"
          }`}
        >
          All
        </Link>
        <Link
          href="/admin/taxonomy/locations?isActive=true"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            currentIsActive === true
              ? "bg-primary text-white shadow-sm"
              : "border border-border bg-surface text-muted hover:bg-surface-raised hover:text-foreground"
          }`}
        >
          Active
        </Link>
        <Link
          href="/admin/taxonomy/locations?isActive=false"
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
        {LOCATION_TYPES.map((t) => (
          <Link
            key={t}
            href={`/admin/taxonomy/locations?type=${t}${currentIsActive !== undefined ? `&isActive=${currentIsActive}` : ""}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              currentType === t
                ? "bg-primary text-white shadow-sm"
                : "border border-border bg-surface text-muted hover:bg-surface-raised hover:text-foreground"
            }`}
          >
            {t}
          </Link>
        ))}
      </div>

      <form className="mt-3" method="get">
        {currentIsActive !== undefined && (
          <input type="hidden" name="isActive" value={String(currentIsActive)} />
        )}
        {currentType && (
          <input type="hidden" name="type" value={currentType} />
        )}
        <div className="flex gap-2">
          <input
            type="text"
            name="search"
            defaultValue={currentSearch ?? ""}
            placeholder="Search locations..."
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
        <p className="mt-6 text-sm text-subtle">No locations found.</p>
      ) : (
        <>
          <p className="mt-4 text-sm text-muted">
            {result.total} location{result.total === 1 ? "" : "s"} total
          </p>
          <ul className="mt-3 space-y-3">
            {result.items.map((loc) => (
              <li key={loc.id}>
                <article className="rounded-xl border border-border bg-surface p-5 shadow-sm transition-all duration-200 hover:border-primary/20 hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/admin/taxonomy/locations/${loc.id}`}
                      className="font-semibold text-foreground hover:text-primary"
                    >
                      {loc.name}
                    </Link>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-border-subtle bg-surface-raised px-2.5 py-0.5 text-xs font-medium text-muted">
                        {loc.type}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          loc.isActive
                            ? "bg-success-light text-success"
                            : "bg-destructive-light text-destructive"
                        }`}
                      >
                        {loc.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted">
                    <span className="font-mono text-xs text-subtle">{loc.slug}</span>
                    {loc.parentName && <span>Parent: {loc.parentName}</span>}
                    {loc.childCount > 0 && (
                      <span>{loc.childCount} child{loc.childCount === 1 ? "" : "ren"}</span>
                    )}
                    {loc.jobCount > 0 && (
                      <span>{loc.jobCount} job{loc.jobCount === 1 ? "" : "s"}</span>
                    )}
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
                    href={`/admin/taxonomy/locations?page=${result.page - 1}${currentIsActive !== undefined ? `&isActive=${currentIsActive}` : ""}${currentType ? `&type=${currentType}` : ""}${currentSearch ? `&search=${encodeURIComponent(currentSearch)}` : ""}`}
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
                    href={`/admin/taxonomy/locations?page=${result.page + 1}${currentIsActive !== undefined ? `&isActive=${currentIsActive}` : ""}${currentType ? `&type=${currentType}` : ""}${currentSearch ? `&search=${encodeURIComponent(currentSearch)}` : ""}`}
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
