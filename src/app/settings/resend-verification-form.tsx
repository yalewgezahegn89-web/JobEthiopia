"use client";

import { useActionState } from "react";
import { resendEmailVerificationAction } from "./actions";
import type { SettingsActionResult } from "./types";
import type { Dictionary } from "@/lib/i18n/dictionary";

export function ResendVerificationForm({
  t,
  className = "",
}: {
  t: Dictionary;
  className?: string;
}) {
  const [state, formAction, isPending] = useActionState<
    SettingsActionResult,
    FormData
  >(resendEmailVerificationAction, {});

  if (state?.ok) {
    return (
      <p role="status" className={`text-sm font-medium text-success ${className}`}>
        {t.settings.resendSent}
      </p>
    );
  }

  const error = state?.code === "rate_limited"
    ? t.settings.resendRateLimited
    : state?.code
      ? t.settings.resendGenericError
      : null;

  return (
    <form action={formAction} className={className}>
      <p className="text-sm leading-6 text-muted">
        {t.settings.emailVerificationSubtitle}
      </p>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isPending}
        className="focus-visible:outline-2 mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? t.settings.resending : t.settings.resendVerification}
      </button>
    </form>
  );
}