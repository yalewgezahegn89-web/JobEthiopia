"use client";

import { useActionState } from "react";
import { changeEmailAction } from "./actions";
import type { SettingsActionResult } from "./types";
import type { Dictionary } from "@/lib/i18n/dictionary";

export function ChangeEmailForm({ t }: { t: Dictionary }) {
  const [state, formAction, isPending] = useActionState<
    SettingsActionResult,
    FormData
  >(changeEmailAction, {});

  if (state?.ok) {
    return (
      <p role="status" className="text-sm font-medium text-success">
        {t.settings.emailChangeSent}
      </p>
    );
  }

  const error =
    state?.code === "invalid_current"
      ? t.settings.emailChangeErrorInvalidCurrent
      : state?.code === "same_email"
        ? t.settings.emailChangeErrorSame
        : state?.code === "rate_limited"
          ? t.settings.emailChangeErrorRateLimited
          : state?.code
            ? t.settings.emailChangeErrorGeneric
            : null;

  return (
    <form action={formAction} className="max-w-sm space-y-5">
      <p className="text-sm leading-6 text-muted">
        {t.settings.changeEmailSubtitle}
      </p>

      <div>
        <label
          htmlFor="newEmail"
          className="block text-sm font-medium text-foreground"
        >
          {t.settings.newEmailLabel}
        </label>
        <input
          id="newEmail"
          name="newEmail"
          type="email"
          required
          autoComplete="email"
          aria-describedby={state.fieldErrors?.newEmail ? "newEmail-error" : undefined}
          className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        {state.fieldErrors?.newEmail ? (
          <p
            id="newEmail-error"
            role="alert"
            className="mt-1.5 text-sm text-destructive"
          >
            {state.fieldErrors.newEmail}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="currentPassword"
          className="block text-sm font-medium text-foreground"
        >
          {t.settings.currentPasswordLabel}
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

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? t.settings.changingEmail : t.settings.changeEmailCta}
      </button>
    </form>
  );
}