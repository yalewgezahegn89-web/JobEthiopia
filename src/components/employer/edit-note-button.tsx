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
      <div className="mt-2 space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={4000}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={pending}
            className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-300"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={openEditor}
      className="rounded border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
    >
      Edit
    </button>
  );
}
