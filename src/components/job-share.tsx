"use client";

import { useCallback, useState } from "react";
import { buildShareLinks } from "@/lib/jobs/public";
import { useI18n } from "@/lib/i18n/client";

export default function JobShare({ title }: { title: string }) {
  const { t } = useI18n();
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [url] = useState<string>(() =>
    typeof window !== "undefined" ? window.location.href : "",
  );

  const handleShare = useCallback(async () => {
    if (!url) {
      return;
    }
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title, url });
        setStatus("idle");
        return;
      } catch (error: unknown) {
        if (error instanceof Error && error.name === "AbortError") {
          setStatus("idle");
          return;
        }
      }
    }

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        setStatus("copied");
        return;
      } catch {
        setStatus("failed");
        return;
      }
    }

    setStatus("failed");
  }, [title, url]);

  const { whatsappUrl } = buildShareLinks(title, url);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleShare}
        className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-raised hover:border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {t.jobs.shareCta}
      </button>
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-raised hover:border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {t.jobs.shareWhatsApp}
      </a>
      {status === "copied" && (
        <span className="text-sm font-medium text-success" role="status">
          {t.jobs.shareCopied}
        </span>
      )}
      {status === "failed" && (
        <span className="text-sm font-medium text-destructive" role="alert">
          {t.jobs.shareCopyFailed}
        </span>
      )}
    </div>
  );
}
