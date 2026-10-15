"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type JobStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "EXPIRED" | "REMOVED";

const VALID_EMPLOYER_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  DRAFT: ["PENDING_REVIEW", "REMOVED"],
  PENDING_REVIEW: ["DRAFT", "REMOVED"],
  PUBLISHED: [],
  EXPIRED: [],
  REMOVED: [],
};

export function JobStatusControls({
  jobId,
  status,
}: {
  jobId: string;
  status: JobStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const allowed = VALID_EMPLOYER_TRANSITIONS[status];

  if (allowed.length === 0) return null;

  async function changeStatus(newStatus: JobStatus) {
    setError(null);
    try {
      const res = await fetch(`/api/employer/jobs/${jobId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to update status");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Failed to update status");
    }
  }

  async function removeJob() {
    setError(null);
    try {
      const res = await fetch(`/api/employer/jobs/${jobId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to remove job");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Failed to remove job");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {allowed.includes("PENDING_REVIEW") && (
        <button
          onClick={() => changeStatus("PENDING_REVIEW")}
          disabled={isPending}
          className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:opacity-90 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
        >
          Submit for Review
        </button>
      )}
      {allowed.includes("DRAFT") && (
        <button
          onClick={() => changeStatus("DRAFT")}
          disabled={isPending}
          className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface-raised focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
        >
          Withdraw from Review
        </button>
      )}
      {allowed.includes("REMOVED") && (
        <button
          onClick={removeJob}
          disabled={isPending}
          className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg border border-destructive/40 bg-destructive-light/40 px-4 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive-light focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
        >
          Remove Job
        </button>
      )}
      {error && (
        <p
          role="alert"
          className="w-full rounded-lg bg-destructive-light px-4 py-2.5 text-sm text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
