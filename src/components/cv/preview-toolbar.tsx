"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { recordCvDownloadAction } from "@/app/cv/actions";

export function PreviewToolbar() {
  const { t } = useI18n();
  const router = useRouter();
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  function handlePrint() {
    if (pending) return;
    setError(false);
    setPrinting(true);
    startTransition(async () => {
      try {
        const result = await recordCvDownloadAction();
        if (!result.ok) setError(true);
      } catch {
        setError(true);
      } finally {
        setPrinting(false);
        window.print();
      }
    });
  }

  return (
    <div className="print-hide flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={handlePrint}
        disabled={pending}
        className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {printing || pending ? t.common.loading : t.cv.printDownload}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => router.push("/cv/edit")}
        className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {t.cv.openEdit}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => router.push("/cv")}
        className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {t.cv.backToCv}
      </button>

      {error ? (
        <p role="alert" className="w-full text-sm text-muted">
          {t.cv.messages.genericError}
        </p>
      ) : null}
    </div>
  );
}