"use client";

import { useEffect, useRef } from "react";
import { useActionState } from "react";
import { forgotPasswordAction } from "./actions";
import type { ForgotPasswordActionState } from "./types";

const initialState: ForgotPasswordActionState = { error: null, success: false };

export default function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState<
    ForgotPasswordActionState,
    FormData
  >(forgotPasswordAction, initialState);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.success) {
      emailRef.current?.focus();
    }
  }, [state.success]);

  return (
    <form action={formAction} className="w-full max-w-sm space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-foreground">
          Email
        </label>
        <input
          ref={emailRef}
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {state.success ? (
        <p role="status" className="text-sm text-success">
          {state.error}
        </p>
      ) : state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
