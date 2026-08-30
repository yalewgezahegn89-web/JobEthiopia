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
        <section className="rounded-lg border border-neutral-200 p-4">
          <h2 className="text-lg font-semibold">Role</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Current role: <strong>{user.role}</strong>
          </p>

          <form action={roleFormAction} className="mt-3">
            <input type="hidden" name="targetId" value={user.id} />
            <div className="flex items-center gap-3">
              <select
                name="role"
                defaultValue={user.role}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
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
                className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
              >
                Save Role
              </button>
            </div>
          </form>
          {roleState.error && (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {roleState.error}
            </p>
          )}
          {roleState.ok && (
            <p role="alert" className="mt-2 text-sm text-green-700">
              User role updated successfully.
            </p>
          )}
        </section>
      )}

      {!canChangeRole && (
        <section className="rounded-lg border border-neutral-200 p-4">
          <h2 className="text-lg font-semibold">Role</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Role: <strong>{user.role}</strong>
          </p>
        </section>
      )}

      {canToggleActive && (
        <section className="rounded-lg border border-neutral-200 p-4">
          <h2 className="text-lg font-semibold">Actions</h2>

          <form action={toggleFormAction} className="mt-3">
            <input type="hidden" name="targetId" value={user.id} />
            <button
              type="submit"
              disabled={togglePending || isSelf}
              className={`rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 ${
                user.isActive
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {user.isActive ? "Deactivate" : "Activate"}
            </button>
          </form>
          {toggleState.error && (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {toggleState.error}
            </p>
          )}
          {toggleState.ok && (
            <p role="alert" className="mt-2 text-sm text-green-700">
              User status updated successfully.
            </p>
          )}
        </section>
      )}

      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-lg font-semibold">Session Management</h2>
        <p className="mt-1 text-sm text-neutral-600">
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
            className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-40"
          >
            Force Logout All Sessions
          </button>
        </form>
        {revokeState.error && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {revokeState.error}
          </p>
        )}
        {revokeState.ok && (
          <p role="alert" className="mt-2 text-sm text-green-700">
            All sessions revoked successfully.
          </p>
        )}
      </section>
    </div>
  );
}
