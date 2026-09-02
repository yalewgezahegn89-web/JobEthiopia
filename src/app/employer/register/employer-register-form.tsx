"use client";

import { useActionState } from "react";
import { employerOnboardingAction } from "./actions";
import type { EmployerOnboardingActionState } from "./types";

const initialState: EmployerOnboardingActionState = { error: null };

const inputClass =
  "mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const labelClass = "block text-sm font-medium text-foreground";

export default function EmployerRegisterForm() {
  const [state, formAction, isPending] = useActionState<
    EmployerOnboardingActionState,
    FormData
  >(employerOnboardingAction, initialState);

  return (
    <form action={formAction} className="w-full max-w-sm space-y-4">
      <div>
        <label htmlFor="name" className={labelClass}>
          Full name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          autoComplete="name"
          className={inputClass}
        />
        {state.fieldErrors?.name ? (
          <p role="alert" className="mt-1.5 text-sm text-destructive">{state.fieldErrors.name}</p>
        ) : null}
      </div>
      <div>
        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className={inputClass}
        />
        {state.fieldErrors?.email ? (
          <p role="alert" className="mt-1.5 text-sm text-destructive">{state.fieldErrors.email}</p>
        ) : null}
      </div>
      <div>
        <label htmlFor="password" className={labelClass}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          className={inputClass}
        />
        {state.fieldErrors?.password ? (
          <p role="alert" className="mt-1.5 text-sm text-destructive">{state.fieldErrors.password}</p>
        ) : null}
      </div>
      <div>
        <label htmlFor="confirmPassword" className={labelClass}>
          Confirm password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          className={inputClass}
        />
        {state.fieldErrors?.confirmPassword ? (
          <p role="alert" className="mt-1.5 text-sm text-destructive">
            {state.fieldErrors.confirmPassword}
          </p>
        ) : null}
      </div>

      <div className="border-t border-border-subtle pt-4">
        <label htmlFor="organizationName" className={labelClass}>
          Organization name
        </label>
        <input
          id="organizationName"
          name="organizationName"
          type="text"
          required
          className={inputClass}
        />
        {state.fieldErrors?.organizationName ? (
          <p role="alert" className="mt-1.5 text-sm text-destructive">
            {state.fieldErrors.organizationName}
          </p>
        ) : null}
      </div>
      <div>
        <label htmlFor="organizationSlug" className={labelClass}>
          Organization slug
        </label>
        <input
          id="organizationSlug"
          name="organizationSlug"
          type="text"
          required
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          className={inputClass}
        />
        <p className="mt-1 text-xs text-subtle">
          Lowercase letters, numbers, and hyphens only.
        </p>
        {state.fieldErrors?.organizationSlug ? (
          <p role="alert" className="mt-1.5 text-sm text-destructive">
            {state.fieldErrors.organizationSlug}
          </p>
        ) : null}
      </div>
      <div>
        <label htmlFor="industry" className={labelClass}>
          Industry
        </label>
        <input
          id="industry"
          name="industry"
          type="text"
          className={inputClass}
        />
        {state.fieldErrors?.industry ? (
          <p role="alert" className="mt-1.5 text-sm text-destructive">{state.fieldErrors.industry}</p>
        ) : null}
      </div>
      <div>
        <label htmlFor="websiteUrl" className={labelClass}>
          Website URL
        </label>
        <input
          id="websiteUrl"
          name="websiteUrl"
          type="url"
          className={inputClass}
        />
        {state.fieldErrors?.websiteUrl ? (
          <p role="alert" className="mt-1.5 text-sm text-destructive">{state.fieldErrors.websiteUrl}</p>
        ) : null}
      </div>
      <div>
        <label htmlFor="contactPhone" className={labelClass}>
          Contact phone
        </label>
        <input
          id="contactPhone"
          name="contactPhone"
          type="tel"
          className={inputClass}
        />
        {state.fieldErrors?.contactPhone ? (
          <p role="alert" className="mt-1.5 text-sm text-destructive">
            {state.fieldErrors.contactPhone}
          </p>
        ) : null}
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
        {isPending ? "Submitting request…" : "Submit employer request"}
      </button>
    </form>
  );
}
