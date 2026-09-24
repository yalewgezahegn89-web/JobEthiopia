"use client";

import { useEffect, useRef } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { verifyEmailLinkAction } from "./actions";
import type { VerifyEmailActionState } from "./actions";
import type { Dictionary } from "@/lib/i18n/dictionary";

export function VerifyEmailFlow({
  token,
  type,
  t,
}: {
  token: string;
  type: "verify" | "change";
  t: Dictionary;
}) {
  const [state, formAction, isPending] = useActionState<
    VerifyEmailActionState,
    FormData
  >(verifyEmailLinkAction, {});

  const formRef = useRef<HTMLFormElement>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    formRef.current?.requestSubmit();
  }, []);

  const decided = state?.success !== undefined;

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10 sm:py-16">
      <div
        role="status"
        className="rounded-xl border border-border bg-surface p-8 text-center shadow-sm"
      >
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {decided
            ? state.success
              ? type === "change"
                ? t.verifyEmail.changeHeading
                : t.verifyEmail.successTitle
              : t.verifyEmail.invalidTitle
            : t.verifyEmail.heading}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          {decided
            ? state.success
              ? type === "change"
                ? t.verifyEmail.successBodyChange
                : t.verifyEmail.successBodyVerify
              : t.verifyEmail.invalidBody
            : t.verifyEmail.pending}
        </p>

        {decided && !state.success ? (
          <Link
            href="/settings"
            className="focus-visible:outline-2 mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {t.verifyEmail.backToSettings}
          </Link>
        ) : null}

        {decided && state.success ? (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {t.verifyEmail.signIn}
            </Link>
            <Link
              href="/settings"
              className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg border border-border bg-surface px-6 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {t.verifyEmail.backToSettings}
            </Link>
          </div>
        ) : null}

        {!decided ? (
          <form
            ref={formRef}
            action={formAction}
            className="mt-6 flex justify-center"
          >
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="type" value={type} />
            <button
              type="submit"
              disabled={isPending}
              className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? t.verifyEmail.verifying : t.verifyEmail.verifyCta}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}