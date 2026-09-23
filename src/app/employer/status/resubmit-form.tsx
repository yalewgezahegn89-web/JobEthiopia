"use client";

import { useActionState } from "react";
import { resubmitEmployerOnboardingAction } from "./actions";
import type { EmployerResubmitActionState } from "./actions";
import type { Dictionary } from "@/lib/i18n/dictionary";

const initialState: EmployerResubmitActionState = {};

const inputClass =
  "mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const labelClass = "block text-sm font-medium text-foreground";

export function EmployerResubmitForm({ t }: { t: Dictionary }) {
  const [state, formAction, isPending] = useActionState<
    EmployerResubmitActionState,
    FormData
  >(resubmitEmployerOnboardingAction, initialState);

  const errorMessage =
    state.errorCode === "DUPLICATE"
      ? t.employerAuth.resubmitErrorDuplicate
      : state.errorCode === "NOT_ELIGIBLE"
        ? t.employerAuth.resubmitErrorNotEligible
        : state.errorCode
          ? t.employerAuth.resubmitErrorNeutral
          : null;

  return (
    <form action={formAction} className="w-full max-w-sm space-y-4">
      <div>
        <label htmlFor="organizationName" className={labelClass}>
          {t.employerAuth.form.organizationLabel}
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
          {t.employerAuth.form.slugLabel}
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
          {t.employerAuth.form.slugHint}
        </p>
        {state.fieldErrors?.organizationSlug ? (
          <p role="alert" className="mt-1.5 text-sm text-destructive">
            {state.fieldErrors.organizationSlug}
          </p>
        ) : null}
      </div>
      <div>
        <label htmlFor="industry" className={labelClass}>
          {t.employerAuth.form.industryLabel}
        </label>
        <input
          id="industry"
          name="industry"
          type="text"
          className={inputClass}
        />
        {state.fieldErrors?.industry ? (
          <p role="alert" className="mt-1.5 text-sm text-destructive">
            {state.fieldErrors.industry}
          </p>
        ) : null}
      </div>
      <div>
        <label htmlFor="websiteUrl" className={labelClass}>
          {t.employerAuth.form.websiteLabel}
        </label>
        <input
          id="websiteUrl"
          name="websiteUrl"
          type="url"
          className={inputClass}
        />
        {state.fieldErrors?.websiteUrl ? (
          <p role="alert" className="mt-1.5 text-sm text-destructive">
            {state.fieldErrors.websiteUrl}
          </p>
        ) : null}
      </div>
      <div>
        <label htmlFor="contactPhone" className={labelClass}>
          {t.employerAuth.form.phoneLabel}
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

      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending
          ? t.employerAuth.form.submitting
          : t.employerAuth.resubmitSubmitCta}
      </button>
    </form>
  );
}