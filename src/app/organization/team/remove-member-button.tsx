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
        className="rounded border border-gray-300 px-3 py-1 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-red-300 dark:hover:bg-red-950"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
