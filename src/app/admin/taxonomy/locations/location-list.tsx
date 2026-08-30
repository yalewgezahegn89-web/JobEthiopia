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
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href="/admin/taxonomy/locations"
          className={`rounded-md px-3 py-1.5 text-sm ${
            currentIsActive === undefined && !currentType
              ? "bg-neutral-900 text-white"
              : "border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
          }`}
        >
          All
        </Link>
        <Link
          href="/admin/taxonomy/locations?isActive=true"
          className={`rounded-md px-3 py-1.5 text-sm ${
            currentIsActive === true
              ? "bg-green-700 text-white"
              : "border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
          }`}
        >
          Active
        </Link>
        <Link
          href="/admin/taxonomy/locations?isActive=false"
          className={`rounded-md px-3 py-1.5 text-sm ${
            currentIsActive === false
              ? "bg-red-700 text-white"
              : "border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
          }`}
        >
          Inactive
        </Link>
        <span className="text-neutral-400">|</span>
        {LOCATION_TYPES.map((t) => (
          <Link
            key={t}
            href={`/admin/taxonomy/locations?type=${t}${currentIsActive !== undefined ? `&isActive=${currentIsActive}` : ""}`}
            className={`rounded-md px-3 py-1.5 text-sm ${
              currentType === t
                ? "bg-neutral-900 text-white"
                : "border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
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
        <p className="mt-6 text-neutral-600">No locations found.</p>
      ) : (
        <>
          <p className="mt-4 text-sm text-neutral-500">
            {result.total} location{result.total === 1 ? "" : "s"} total
          </p>
          <ul className="mt-3 space-y-2">
            {result.items.map((loc) => (
              <li key={loc.id}>
                <Link
                  href={`/admin/taxonomy/locations/${loc.id}`}
                  className="block rounded-md border border-neutral-200 p-3 hover:bg-neutral-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{loc.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                        {loc.type}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          loc.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {loc.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
                    <span className="font-mono">{loc.slug}</span>
                    {loc.parentName && <span>Parent: {loc.parentName}</span>}
                    {loc.childCount > 0 && (
                      <span>{loc.childCount} child{loc.childCount === 1 ? "" : "ren"}</span>
                    )}
                    {loc.jobCount > 0 && (
                      <span>{loc.jobCount} job{loc.jobCount === 1 ? "" : "s"}</span>
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
                    href={`/admin/taxonomy/locations?page=${result.page - 1}${currentIsActive !== undefined ? `&isActive=${currentIsActive}` : ""}${currentType ? `&type=${currentType}` : ""}${currentSearch ? `&search=${encodeURIComponent(currentSearch)}` : ""}`}
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
                    href={`/admin/taxonomy/locations?page=${result.page + 1}${currentIsActive !== undefined ? `&isActive=${currentIsActive}` : ""}${currentType ? `&type=${currentType}` : ""}${currentSearch ? `&search=${encodeURIComponent(currentSearch)}` : ""}`}
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
