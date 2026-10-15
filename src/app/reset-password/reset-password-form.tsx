"use client";

import { useActionState } from "react";
import { resetPasswordAction } from "./actions";
import type { ResetPasswordActionState } from "./types";

const initialState: ResetPasswordActionState = { error: null };

export default function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState<
    ResetPasswordActionState,
    FormData
  >(resetPasswordAction, initialState);

  return (
    <form action={formAction} className="w-full max-w-sm space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-foreground">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <p className="mt-1 text-xs text-subtle">
          Must be at least 8 characters.
        </p>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Resetting…" : "Reset password"}
      </button>
    </form>
  );
}
