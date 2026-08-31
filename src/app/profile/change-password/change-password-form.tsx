"use client";

import { useActionState } from "react";
import { changePasswordAction } from "./actions";
import type { ChangePasswordActionState } from "./types";

export default function ChangePasswordForm({
  initialState: initial = {},
}: {
  initialState?: ChangePasswordActionState;
} = {}) {
  const [state, formAction, isPending] = useActionState<
    ChangePasswordActionState,
    FormData
  >(changePasswordAction, initial);

  return (
    <form action={formAction} className="max-w-sm space-y-4">
      <div>
        <label htmlFor="currentPassword" className="block text-sm font-medium">
          Current password
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          aria-describedby={
            state.fieldErrors?.currentPassword
              ? "currentPassword-error"
              : undefined
          }
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
        />
        {state.fieldErrors?.currentPassword ? (
          <p
            id="currentPassword-error"
            role="alert"
            className="mt-1 text-sm text-red-600"
          >
            {state.fieldErrors.currentPassword}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="newPassword" className="block text-sm font-medium">
          New password
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          aria-describedby={
            state.fieldErrors?.newPassword ? "newPassword-error" : undefined
          }
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
        />
        <p className="mt-1 text-xs text-neutral-500">
          Must be at least 8 characters.
        </p>
        {state.fieldErrors?.newPassword ? (
          <p
            id="newPassword-error"
            role="alert"
            className="mt-1 text-sm text-red-600"
          >
            {state.fieldErrors.newPassword}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium">
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          aria-describedby={
            state.fieldErrors?.confirmPassword
              ? "confirmPassword-error"
              : undefined
          }
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
        />
        {state.fieldErrors?.confirmPassword ? (
          <p
            id="confirmPassword-error"
            role="alert"
            className="mt-1 text-sm text-red-600"
          >
            {state.fieldErrors.confirmPassword}
          </p>
        ) : null}
      </div>

      {state.formError ? (
        <p role="alert" className="text-sm text-red-600">
          {state.formError}
        </p>
      ) : null}

      {state.success ? (
        <p role="status" className="text-sm font-medium text-green-700">
          {state.success}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {isPending ? "Changing…" : "Change password"}
      </button>
    </form>
  );
}
