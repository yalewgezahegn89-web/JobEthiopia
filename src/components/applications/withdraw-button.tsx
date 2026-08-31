"use client";

import { useState, useTransition } from "react";

type WithdrawState = "idle" | "working" | "done" | "failed";

export function ApplicationWithdraw({
  applicationId,
}: {
  applicationId: string;
}) {
  const [state, setState] = useState<WithdrawState>("idle");
  const [pending, startTransition] = useTransition();

  function withdraw() {
    startTransition(async () => {
      setState("working");
      try {
        const res = await fetch(`/api/applications/${applicationId}`, {
          method: "POST",
        });
        if (res.ok) {
          setState("done");
        } else {
          setState("failed");
        }
      } catch {
        setState("failed");
      }
    });
  }

  if (state === "done") {
    return (
      <span className="inline-flex items-center justify-center rounded-md bg-green-100 px-4 py-2 text-sm font-semibold text-green-800 dark:bg-green-900 dark:text-green-200">
        Application withdrawn
      </span>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={withdraw}
        disabled={pending || state === "working"}
        className="inline-flex items-center justify-center rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
      >
        {state === "working" ? "Withdrawing…" : "Withdraw"}
      </button>
      {state === "failed" && (
        <span className="text-sm font-medium text-red-700 dark:text-red-400">
          Could not withdraw. Please try again.
        </span>
      )}
    </div>
  );
}
