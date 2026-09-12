"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { deleteCvAction } from "@/app/cv/actions";

export function CvDeleteButton() {
  const { t } = useI18n();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [_error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (pending) return;
    setError(false);
    startTransition(async () => {
      try {
        const result = await deleteCvAction();
        if (!result.ok) {
          setError(true);
          return;
        }
        router.push("/cv");
        router.refresh();
      } catch {
        setError(true);
      }
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg border border-destructive px-5 py-2.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive-light focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {t.cv.deleteCta}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive bg-destructive-light/40 p-3">
      <p className="text-sm text-destructive">{t.cv.confirmDelete}</p>
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-destructive-hover focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? t.common.loading : t.cv.deleteCta}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={pending}
        className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {t.common.cancel}
      </button>
    </div>
  );
}