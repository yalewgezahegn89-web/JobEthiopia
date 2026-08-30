"use client";

import Link from "next/link";
import type { UserAdminPaginated } from "@/lib/admin/users";

const ROLES = ["SUPER_ADMIN", "ADMIN", "MODERATOR", "ORGANIZATION_ADMIN", "CANDIDATE"] as const;

const ROLE_STYLES: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-100 text-purple-800",
  ADMIN: "bg-blue-100 text-blue-800",
  MODERATOR: "bg-amber-100 text-amber-800",
  ORGANIZATION_ADMIN: "bg-teal-100 text-teal-800",
  CANDIDATE: "bg-neutral-100 text-neutral-800",
};

export default function UsersList({
  result,
  currentIsActive,
  currentRole,
}: {
  result: UserAdminPaginated;
  currentIsActive?: boolean;
  currentRole?: string;
}) {
  return (
    <div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href="/admin/users"
          className={`rounded-md px-3 py-1.5 text-sm ${
            currentIsActive === undefined && !currentRole
              ? "bg-neutral-900 text-white"
              : "border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
          }`}
        >
          All
        </Link>
        <Link
          href="/admin/users?isActive=true"
          className={`rounded-md px-3 py-1.5 text-sm ${
            currentIsActive === true
              ? "bg-green-700 text-white"
              : "border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
          }`}
        >
          Active
        </Link>
        <Link
          href="/admin/users?isActive=false"
          className={`rounded-md px-3 py-1.5 text-sm ${
            currentIsActive === false
              ? "bg-red-700 text-white"
              : "border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
          }`}
        >
          Inactive
        </Link>
        <span className="text-neutral-400">|</span>
        {ROLES.map((r) => (
          <Link
            key={r}
            href={`/admin/users?role=${r}${currentIsActive !== undefined ? `&isActive=${currentIsActive}` : ""}`}
            className={`rounded-md px-3 py-1.5 text-sm ${
              currentRole === r
                ? "bg-neutral-900 text-white"
                : "border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            {r}
          </Link>
        ))}
      </div>

      {result.items.length === 0 ? (
        <p className="mt-6 text-neutral-600">No users found.</p>
      ) : (
        <>
          <p className="mt-4 text-sm text-neutral-500">
            {result.total} user{result.total === 1 ? "" : "s"} total
          </p>
          <ul className="mt-3 space-y-2">
            {result.items.map((user) => (
              <li key={user.id}>
                <Link
                  href={`/admin/users/${user.id}`}
                  className="block rounded-md border border-neutral-200 p-3 hover:bg-neutral-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{user.name}</span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          ROLE_STYLES[user.role] ?? "bg-neutral-100 text-neutral-800"
                        }`}
                      >
                        {user.role}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          user.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
                    <span>{user.email}</span>
                    <span>
                      {user.sessionCount} active session{user.sessionCount === 1 ? "" : "s"}
                    </span>
                    <span>
                      Created: {new Date(user.createdAt).toLocaleDateString()}
                    </span>
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
                    href={`/admin/users?page=${result.page - 1}${currentIsActive !== undefined ? `&isActive=${currentIsActive}` : ""}${currentRole ? `&role=${currentRole}` : ""}`}
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
                    href={`/admin/users?page=${result.page + 1}${currentIsActive !== undefined ? `&isActive=${currentIsActive}` : ""}${currentRole ? `&role=${currentRole}` : ""}`}
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
