"use client";

import { useState, useTransition } from "react";

export function SaveButton({
  jobId,
  initialSaved,
}: {
  jobId: string;
  initialSaved: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      try {
        if (saved) {
          const res = await fetch(`/api/saved-jobs/${jobId}`, {
            method: "DELETE",
          });
          if (res.ok) {
            setSaved(false);
          }
        } else {
          const res = await fetch("/api/saved-jobs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId }),
          });
          if (res.ok) {
            setSaved(true);
          }
        }
      } catch {
        // ignore errors
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-900"
    >
      {pending ? "Saving…" : saved ? "Saved" : "Save job"}
    </button>
  );
}
