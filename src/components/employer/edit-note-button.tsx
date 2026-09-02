"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function EditNoteButton({
  applicationId,
  noteId,
  initialBody,
}: {
  applicationId: string;
  noteId: string;
  initialBody: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(initialBody);
  const [error, setError] = useState<string | null>(null);

  function openEditor() {
    setBody(initialBody);
    setEditing(true);
    setError(null);
  }

  function save() {
    const value = body.trim();
    if (!value || value.length > 4000) {
      setError("Note must be between 1 and 4000 characters.");
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(
          `/api/employer/applications/${applicationId}/notes/${noteId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ body: value }),
          },
        );

        if (res.ok) {
          setEditing(false);
          router.refresh();
          return;
        }

        let message = "Unable to update note.";
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
        } catch {
          message = "Unable to update note.";
        }
        setError(message);
      } catch {
        setError("Unable to update note.");
      }
    });
  }

  if (editing) {
    return (
      <div className="mt-2 space-y-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={4000}
          aria-label="Edit note"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={pending}
            className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-1.5 text-sm font-semibold text-muted transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={openEditor}
      className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-raised focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      Edit
    </button>
  );
}
