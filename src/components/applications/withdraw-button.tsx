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
      <span className="inline-flex items-center justify-center rounded-full bg-success-light px-4 py-2 text-sm font-semibold text-success">
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
        className="inline-flex items-center justify-center rounded-lg border border-destructive px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive-light disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {state === "working" ? "Withdrawing…" : "Withdraw"}
      </button>
      {state === "failed" && (
        <span className="text-sm font-medium text-destructive" role="alert">
          Could not withdraw. Please try again.
        </span>
      )}
    </div>
  );
}
