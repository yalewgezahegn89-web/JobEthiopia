"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import {
  deleteCoverLetterAction,
  duplicateCoverLetterAction,
} from "@/app/cover-letter/actions";

type CoverLetterRowActionsProps = {
  id: string;
};

/**
 * Duplicate / delete actions for a cover letter list row (Phase 13).
 * Delete requires an explicit two-step confirm; both calls are ownership
 * scoped on the server and triggered through trusted CSRF-guarded actions.
 */
export function CoverLetterRowActions({ id }: CoverLetterRowActionsProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDuplicate() {
    if (pending) return;
    setError(false);
    startTransition(async () => {
      try {
        const data = new FormData();
        data.set("id", id);
        await duplicateCoverLetterAction({ ok: false }, data);
      } catch {
        setError(true);
      }
    });
  }

  function handleDelete() {
    if (pending) return;
    setError(false);
    startTransition(async () => {
      try {
        const data = new FormData();
        data.set("id", id);
        const result = await deleteCoverLetterAction({ ok: false }, data);
        if (!result.ok) {
          setError(true);
          return;
        }
        setConfirming(false);
        router.refresh();
      } catch {
        setError(true);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={handleDuplicate}
        className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t.coverLetter.duplicateCta}
      </button>

      {!confirming ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(true)}
          className="focus-visible:outline-2 rounded-lg border border-destructive px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive-light focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t.coverLetter.deleteCta}
        </button>
      ) : (
        <span className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-destructive bg-destructive-light/40 px-3 py-1.5">
          <span className="text-sm text-destructive">
            {t.coverLetter.confirmDelete}
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={handleDelete}
            className="rounded-lg bg-destructive px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-destructive-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? t.common.loading : t.coverLetter.deleteCta}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirming(false)}
            className="rounded-lg border border-border bg-surface px-3 py-1 text-xs font-semibold text-muted transition-colors hover:bg-surface-raised hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t.common.cancel}
          </button>
        </span>
      )}

      {error ? (
        <span role="alert" className="text-sm text-destructive">
          {t.coverLetter.messages.error}
        </span>
      ) : null}
    </div>
  );
}