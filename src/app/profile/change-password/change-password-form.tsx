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
    <form action={formAction} className="max-w-sm space-y-5">
      <div>
        <label
          htmlFor="currentPassword"
          className="block text-sm font-medium text-foreground"
        >
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
          className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        {state.fieldErrors?.currentPassword ? (
          <p
            id="currentPassword-error"
            role="alert"
            className="mt-1.5 text-sm text-destructive"
          >
            {state.fieldErrors.currentPassword}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="newPassword"
          className="block text-sm font-medium text-foreground"
        >
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
          className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <p className="mt-1.5 text-xs text-subtle">
          Must be at least 8 characters.
        </p>
        {state.fieldErrors?.newPassword ? (
          <p
            id="newPassword-error"
            role="alert"
            className="mt-1.5 text-sm text-destructive"
          >
            {state.fieldErrors.newPassword}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="block text-sm font-medium text-foreground"
        >
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
          className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        {state.fieldErrors?.confirmPassword ? (
          <p
            id="confirmPassword-error"
            role="alert"
            className="mt-1.5 text-sm text-destructive"
          >
            {state.fieldErrors.confirmPassword}
          </p>
        ) : null}
      </div>

      {state.formError ? (
        <p role="alert" className="text-sm text-destructive">
          {state.formError}
        </p>
      ) : null}

      {state.success ? (
        <p role="status" className="text-sm font-medium text-success">
          {state.success}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Changing…" : "Change password"}
      </button>
    </form>
  );
}