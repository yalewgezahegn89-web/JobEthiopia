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
    <div className="mb-4 flex flex-wrap gap-2">
      {allowed.includes("PENDING_REVIEW") && (
        <button
          onClick={() => changeStatus("PENDING_REVIEW")}
          disabled={isPending}
          className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          Submit for Review
        </button>
      )}
      {allowed.includes("DRAFT") && (
        <button
          onClick={() => changeStatus("DRAFT")}
          disabled={isPending}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300"
        >
          Withdraw from Review
        </button>
      )}
      {allowed.includes("REMOVED") && (
        <button
          onClick={removeJob}
          disabled={isPending}
          className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-300"
        >
          Remove Job
        </button>
      )}
      {error && (
        <p className="w-full text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
