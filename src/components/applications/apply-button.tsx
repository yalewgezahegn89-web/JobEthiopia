"use client";

import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/client";

type ApplyState =
  | { kind: "idle" }
  | { kind: "applying" }
  | { kind: "success"; jobTitle: string }
  | { kind: "error"; message: string };

export function ApplyButton({ jobId, jobTitle }: { jobId: string; jobTitle: string }) {
  const { t } = useI18n();
  const [state, setState] = useState<ApplyState>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      setState({ kind: "applying" });
      try {
        const res = await fetch("/api/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
        });
        if (res.status === 201) {
          setState({ kind: "success", jobTitle });
          return;
        }
        if (res.status === 409) {
          setState({ kind: "error", message: t.apply.alreadyApplied });
          return;
        }
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setState({
          kind: "error",
          message: body?.error ?? t.apply.submissionFailed,
        });
      } catch {
        setState({
          kind: "error",
          message: t.apply.submissionFailed,
        });
      }
    });
  }

  if (state.kind === "success") {
    return (
      <span className="inline-block rounded-full bg-success-light px-6 py-3 text-base font-semibold text-success">
        {t.apply.applicationSubmitted}
      </span>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-border bg-surface p-4 text-center">
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-primary-hover hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {pending ? t.apply.applying : t.apply.applyNow}
      </button>
      <p className="mt-2 text-xs text-subtle">{t.apply.applyHint}</p>
      {state.kind === "error" && (
        <p className="mt-2 text-sm font-medium text-destructive" role="alert">
          {state.message}
        </p>
      )}
    </div>
  );
}
