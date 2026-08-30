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
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          ref={emailRef}
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
        />
      </div>

      {state.success ? (
        <p role="status" className="text-sm text-neutral-600">
          {state.error}
        </p>
      ) : state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {isPending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
