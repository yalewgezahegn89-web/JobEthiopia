"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function AddNoteForm({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = body.trim();
    if (!value || value.length > 4000) {
      setError("Note must be between 1 and 4000 characters.");
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(
          `/api/employer/applications/${applicationId}/notes`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ body: value }),
          },
        );

        if (res.ok) {
          setBody("");
          router.refresh();
          return;
        }

        let message = "Unable to save note.";
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
        } catch {
          message = "Unable to save note.";
        }
        setError(message);
      } catch {
        setError("Unable to save note.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700 dark:text-gray-300">
          Add note
        </span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={4000}
          placeholder="Screening observations for your team…"
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving…" : "Add note"}
        </button>
        <span className="text-xs text-gray-400">{body.length}/4000</span>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
