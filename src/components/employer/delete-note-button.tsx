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
        className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg border border-destructive/40 bg-surface px-3 py-1.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive-light focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
