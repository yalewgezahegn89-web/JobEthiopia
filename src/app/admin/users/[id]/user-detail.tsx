"use client";

import { useActionState } from "react";
import {
  toggleUserActiveAction,
  revokeUserSessionsAction,
  changeUserRoleAction,
  type UserActionResult,
} from "../actions";
import type { UserRole } from "@/lib/auth/roles";

const INITIAL_STATE: UserActionResult = { ok: false };

const ROLES = ["SUPER_ADMIN", "ADMIN", "MODERATOR", "ORGANIZATION_ADMIN", "CANDIDATE"] as const;

type UserDetailProps = {
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    isActive: boolean;
    sessionCount: number;
  };
  actorRole: UserRole;
};

export default function UserDetail({ user, actorRole }: UserDetailProps) {
  const canToggleActive = actorRole === "SUPER_ADMIN" || actorRole === "ADMIN";
  const canChangeRole = actorRole === "SUPER_ADMIN";
  const isSelf = false;

  const [toggleState, toggleFormAction, togglePending] = useActionState<
    UserActionResult,
    FormData
  >(toggleUserActiveAction, INITIAL_STATE);

  const [revokeState, revokeFormAction, revokePending] = useActionState<
    UserActionResult,
    FormData
  >(revokeUserSessionsAction, INITIAL_STATE);

  const [roleState, roleFormAction, rolePending] = useActionState<
    UserActionResult,
    FormData
  >(changeUserRoleAction, INITIAL_STATE);

  return (
    <div className="space-y-4">
      {canChangeRole && (
        <section className="rounded-xl border border-border bg-surface p-6 shadow-sm mt-6">
          <h2 className="text-lg font-semibold text-foreground">Role</h2>
          <p className="mt-1 text-sm text-muted">
            Current role: <strong>{user.role}</strong>
          </p>

          <form action={roleFormAction} className="mt-3">
            <input type="hidden" name="targetId" value={user.id} />
            <div className="flex items-center gap-3">
              <select
                name="role"
                defaultValue={user.role}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={rolePending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
              >
                Save Role
              </button>
            </div>
          </form>
          {roleState.error && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {roleState.error}
            </p>
          )}
          {roleState.ok && (
            <p role="alert" className="mt-2 text-sm text-success">
              User role updated successfully.
            </p>
          )}
        </section>
      )}

      {!canChangeRole && (
        <section className="rounded-xl border border-border bg-surface p-6 shadow-sm mt-6">
          <h2 className="text-lg font-semibold text-foreground">Role</h2>
          <p className="mt-1 text-sm text-muted">
            Role: <strong>{user.role}</strong>
          </p>
        </section>
      )}

      {canToggleActive && (
        <section className="rounded-xl border border-border bg-surface p-6 shadow-sm mt-6">
          <h2 className="text-lg font-semibold text-foreground">Actions</h2>

          <form action={toggleFormAction} className="mt-3">
            <input type="hidden" name="targetId" value={user.id} />
            <button
              type="submit"
              disabled={togglePending || isSelf}
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 ${
                user.isActive
                  ? "bg-warning hover:opacity-90 hover:shadow-md"
                  : "bg-success hover:opacity-90 hover:shadow-md"
              }`}
            >
              {user.isActive ? "Deactivate" : "Activate"}
            </button>
          </form>
          {toggleState.error && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {toggleState.error}
            </p>
          )}
          {toggleState.ok && (
            <p role="alert" className="mt-2 text-sm text-success">
              User status updated successfully.
            </p>
          )}
        </section>
      )}

      <section className="rounded-xl border border-border bg-surface p-6 shadow-sm mt-6">
        <h2 className="text-lg font-semibold text-foreground">Session Management</h2>
        <p className="mt-1 text-sm text-muted">
          {user.sessionCount} active session{user.sessionCount === 1 ? "" : "s"} for this user.
        </p>

        <form
          action={revokeFormAction}
          onSubmit={(e) => {
            if (
              !confirm(
                "Are you sure you want to force-logout this user from all devices?",
              )
            ) {
              e.preventDefault();
            }
          }}
          className="mt-3"
        >
          <input type="hidden" name="targetId" value={user.id} />
          <button
            type="submit"
            disabled={revokePending || isSelf}
            className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
          >
            Force Logout All Sessions
          </button>
        </form>
        {revokeState.error && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {revokeState.error}
          </p>
        )}
        {revokeState.ok && (
          <p role="alert" className="mt-2 text-sm text-success">
            All sessions revoked successfully.
          </p>
        )}
      </section>
    </div>
  );
}
