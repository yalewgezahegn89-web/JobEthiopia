"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function DeleteNoteButton({
  applicationId,
  noteId,
}: {
  applicationId: string;
  noteId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(
          `/api/employer/applications/${applicationId}/notes/${noteId}`,
          { method: "DELETE" },
        );

        if (res.ok) {
          router.refresh();
          return;
        }

        let message = "Unable to delete note.";
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
        } catch {
          message = "Unable to delete note.";
        }
        setError(message);
      } catch {
        setError("Unable to delete note.");
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="rounded border border-gray-300 px-3 py-1 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-red-300 dark:hover:bg-red-950"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
