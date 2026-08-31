"use client";

import { useActionState } from "react";
import { registerAction } from "./actions";
import type { RegisterActionState } from "./types";

const initialState: RegisterActionState = { error: null };

export default function RegisterForm() {
  const [state, formAction, isPending] = useActionState<
    RegisterActionState,
    FormData
  >(registerAction, initialState);

  return (
    <form action={formAction} className="w-full max-w-sm space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium">
          Full name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          autoComplete="name"
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
        />
        {state.fieldErrors?.name ? (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.name}</p>
        ) : null}
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
        />
        {state.fieldErrors?.email ? (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.email}</p>
        ) : null}
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
        />
        {state.fieldErrors?.password ? (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.password}</p>
        ) : null}
      </div>
      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium">
          Confirm password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
        />
        {state.fieldErrors?.confirmPassword ? (
          <p className="mt-1 text-sm text-red-600">
            {state.fieldErrors.confirmPassword}
          </p>
        ) : null}
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
        {isPending ? "Creating account…" : "Register"}
      </button>
    </form>
  );
}
