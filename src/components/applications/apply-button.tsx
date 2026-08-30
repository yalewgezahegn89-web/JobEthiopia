"use client";

import { useState, useTransition } from "react";

type ApplyState =
  | { kind: "idle" }
  | { kind: "applying" }
  | { kind: "success"; jobTitle: string }
  | { kind: "error"; message: string };

export function ApplyButton({ jobId, jobTitle }: { jobId: string; jobTitle: string }) {
  const [state, setState] = useState<ApplyState>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      setState({ kind: "applying" });
      try {
        const res = await fetch("/api/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
        });
        if (res.status === 201) {
          setState({ kind: "success", jobTitle });
          return;
        }
        if (res.status === 409) {
          setState({ kind: "error", message: "You have already applied to this job." });
          return;
        }
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setState({
          kind: "error",
          message: body?.error ?? "We could not submit your application. Please try again.",
        });
      } catch {
        setState({
          kind: "error",
          message: "We could not submit your application. Please try again.",
        });
      }
    });
  }

  if (state.kind === "success") {
    return (
      <span className="inline-block rounded-md bg-green-100 px-6 py-3 text-base font-semibold text-green-800 dark:bg-green-900 dark:text-green-200">
        Application submitted
      </span>
    );
  }

  return (
    <div className="mt-4 rounded-md border border-gray-200 p-4 text-center dark:border-gray-800">
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-700 dark:hover:bg-blue-600 sm:w-auto"
      >
        {pending ? "Applying…" : "Apply Now"}
      </button>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        Submits your application to this job directly.
      </p>
      {state.kind === "error" && (
        <p className="mt-2 text-sm font-medium text-red-700 dark:text-red-400">
          {state.message}
        </p>
      )}
    </div>
  );
}
