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
        <label htmlFor="password" className="block text-sm font-medium">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
        />
        <p className="mt-1 text-xs text-neutral-500">
          Must be at least 8 characters.
        </p>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {isPending ? "Resetting…" : "Reset password"}
      </button>
    </form>
  );
}
