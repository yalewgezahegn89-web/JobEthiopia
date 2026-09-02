"use client";

import Link from "next/link";
import type { UserAdminPaginated } from "@/lib/admin/users";

const ROLES = ["SUPER_ADMIN", "ADMIN", "MODERATOR", "ORGANIZATION_ADMIN", "CANDIDATE"] as const;

const ROLE_STYLES: Record<string, string> = {
  SUPER_ADMIN: "bg-accent-light text-foreground",
  ADMIN: "bg-primary-light text-primary",
  MODERATOR: "bg-warning-light text-warning",
  ORGANIZATION_ADMIN: "bg-surface-raised border border-border-subtle text-muted",
  CANDIDATE: "bg-surface-raised text-subtle",
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
      <div className="mt-4 flex flex-wrap gap-3">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/users"
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
              currentIsActive === undefined && !currentRole
                ? "bg-primary text-white shadow-sm"
                : "bg-surface border border-border text-muted hover:bg-surface-raised hover:text-foreground"
            }`}
          >
            All
          </Link>
          <Link
            href="/admin/users?isActive=true"
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
              currentIsActive === true
                ? "bg-primary text-white shadow-sm"
                : "bg-surface border border-border text-muted hover:bg-surface-raised hover:text-foreground"
            }`}
          >
            Active
          </Link>
          <Link
            href="/admin/users?isActive=false"
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
              currentIsActive === false
                ? "bg-primary text-white shadow-sm"
                : "bg-surface border border-border text-muted hover:bg-surface-raised hover:text-foreground"
            }`}
          >
            Inactive
          </Link>
        </div>
        <div className="flex items-center text-border-subtle">|</div>
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <Link
              key={r}
              href={`/admin/users?role=${r}${currentIsActive !== undefined ? `&isActive=${currentIsActive}` : ""}`}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                currentRole === r
                  ? "bg-primary text-white shadow-sm"
                  : "bg-surface border border-border text-muted hover:bg-surface-raised hover:text-foreground"
              }`}
            >
              {r}
            </Link>
          ))}
        </div>
      </div>

      {result.items.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No users found.</p>
      ) : (
        <>
          <p className="mt-4 text-sm text-muted">
            {result.total} user{result.total === 1 ? "" : "s"} total
          </p>
          <ul className="mt-3 space-y-3">
            {result.items.map((user) => (
              <li key={user.id}>
                <Link
                  href={`/admin/users/${user.id}`}
                  className="block rounded-xl border border-border bg-surface p-5 shadow-sm transition-all duration-200 hover:border-primary/20 hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground hover:text-primary">{user.name}</span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          ROLE_STYLES[user.role] ?? "bg-surface-raised text-subtle"
                        }`}
                      >
                        {user.role}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          user.isActive
                            ? "bg-success-light text-success"
                            : "bg-destructive-light text-destructive"
                        }`}
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                    <span>{user.email}</span>
                    <span>
                      {user.sessionCount} active session{user.sessionCount === 1 ? "" : "s"}
                    </span>
                    <span className="text-xs text-subtle">
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
                    className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-muted hover:bg-surface-raised hover:text-foreground transition-all duration-200"
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
                    href={`/admin/users?page=${result.page + 1}${currentIsActive !== undefined ? `&isActive=${currentIsActive}` : ""}${currentRole ? `&role=${currentRole}` : ""}`}
                    className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-muted hover:bg-surface-raised hover:text-foreground transition-all duration-200"
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
