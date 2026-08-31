"use client";

import { useActionState } from "react";
import { employerOnboardingAction } from "./actions";
import type { EmployerOnboardingActionState } from "./types";

const initialState: EmployerOnboardingActionState = { error: null };

export default function EmployerRegisterForm() {
  const [state, formAction, isPending] = useActionState<
    EmployerOnboardingActionState,
    FormData
  >(employerOnboardingAction, initialState);

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

      <div className="border-t border-neutral-200 pt-4">
        <label htmlFor="organizationName" className="block text-sm font-medium">
          Organization name
        </label>
        <input
          id="organizationName"
          name="organizationName"
          type="text"
          required
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
        />
        {state.fieldErrors?.organizationName ? (
          <p className="mt-1 text-sm text-red-600">
            {state.fieldErrors.organizationName}
          </p>
        ) : null}
      </div>
      <div>
        <label htmlFor="organizationSlug" className="block text-sm font-medium">
          Organization slug
        </label>
        <input
          id="organizationSlug"
          name="organizationSlug"
          type="text"
          required
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
        />
        <p className="mt-1 text-xs text-neutral-500">
          Lowercase letters, numbers, and hyphens only.
        </p>
        {state.fieldErrors?.organizationSlug ? (
          <p className="mt-1 text-sm text-red-600">
            {state.fieldErrors.organizationSlug}
          </p>
        ) : null}
      </div>
      <div>
        <label htmlFor="industry" className="block text-sm font-medium">
          Industry
        </label>
        <input
          id="industry"
          name="industry"
          type="text"
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
        />
        {state.fieldErrors?.industry ? (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.industry}</p>
        ) : null}
      </div>
      <div>
        <label htmlFor="websiteUrl" className="block text-sm font-medium">
          Website URL
        </label>
        <input
          id="websiteUrl"
          name="websiteUrl"
          type="url"
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
        />
        {state.fieldErrors?.websiteUrl ? (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.websiteUrl}</p>
        ) : null}
      </div>
      <div>
        <label htmlFor="contactPhone" className="block text-sm font-medium">
          Contact phone
        </label>
        <input
          id="contactPhone"
          name="contactPhone"
          type="tel"
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
        />
        {state.fieldErrors?.contactPhone ? (
          <p className="mt-1 text-sm text-red-600">
            {state.fieldErrors.contactPhone}
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
        {isPending ? "Submitting request…" : "Submit employer request"}
      </button>
    </form>
  );
}
