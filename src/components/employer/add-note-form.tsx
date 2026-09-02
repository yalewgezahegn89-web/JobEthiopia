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
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block text-sm">
        <span className="mb-1.5 block font-semibold text-foreground">
          Add note
        </span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={4000}
          placeholder="Screening observations for your team…"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving…" : "Add note"}
        </button>
        <span className="text-xs text-subtle">{body.length}/4000</span>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
