"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/client";
import { recordCoverLetterDownloadAction } from "@/app/cover-letter/actions";

type CoverLetterPreviewToolbarProps = {
  id: string;
};

/**
 * Print / edit / back controls for a cover-letter preview (Phase 13).
 * Export is browser print (Download/Print as PDF), matching the CV document
 * limitation; no programmatic PDF generation is introduced.
 */
export function CoverLetterPreviewToolbar({ id }: CoverLetterPreviewToolbarProps) {
  const { t } = useI18n();

  const [downloaded, setDownloaded] = useState(false);

  function handlePrint() {
    if (downloaded) {
      window.print();
      return;
    }
    setDownloaded(true);
    void recordCoverLetterDownloadAction()
      .catch(() => undefined)
      .finally(() => {
        requestAnimationFrame(() => window.print());
      });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border py-4 print:hidden">
      <button
        type="button"
        onClick={handlePrint}
        className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {t.coverLetter.preview.printDownload}
      </button>
      <Link
        href={`/cover-letter/${id}/edit`}
        className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {t.coverLetter.preview.edit}
      </Link>
      <Link
        href="/cover-letter"
        className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {t.coverLetter.preview.back}
      </Link>
    </div>
  );
}