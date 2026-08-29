"use client";

import { useCallback, useState } from "react";
import { buildShareLinks } from "@/lib/jobs/public";

export default function JobShare({ title }: { title: string }) {
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
        className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
      >
        Share
      </button>
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
      >
        Share on WhatsApp
      </a>
      {status === "copied" && (
        <span className="text-sm font-medium text-green-700 dark:text-green-300">
          Link copied
        </span>
      )}
      {status === "failed" && (
        <span className="text-sm font-medium text-red-700 dark:text-red-300">
          Could not copy the link. Please copy the URL manually.
        </span>
      )}
    </div>
  );
}
