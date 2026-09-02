"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function RemoveMemberButton({
  membershipId,
}: {
  membershipId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/employer/team/${membershipId}`, {
          method: "DELETE",
        });
        if (res.status === 409) {
          setError(
            "An organization must have at least one active administrator.",
          );
          return;
        }
        if (res.ok) {
          router.refresh();
          return;
        }
        setError("Unable to remove team member.");
      } catch {
        setError("Unable to remove team member.");
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
        {pending ? "Removing…" : "Remove"}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
