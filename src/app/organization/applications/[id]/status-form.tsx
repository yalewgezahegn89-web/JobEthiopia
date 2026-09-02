"use client";

import { useState } from "react";

type Status = "REVIEWING" | "SHORTLISTED" | "REJECTED";

export function StatusForm({
  applicationId,
  currentStatus,
}: {
  applicationId: string;
  currentStatus: string;
}) {
  const [selectedStatus, setSelectedStatus] = useState<Status | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const showControls =
    currentStatus === "SUBMITTED" || currentStatus === "REVIEWING";

  if (!showControls) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStatus) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch(`/api/applications/${applicationId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: selectedStatus }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to update status");
        return;
      }

      setSuccess(true);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface-raised/50 p-5">
      <h3 className="text-sm font-semibold text-foreground">Update Status</h3>
      <p className="mt-1 text-xs text-muted">
        Move this application to the next stage.
      </p>
      <form
        onSubmit={handleSubmit}
        className="mt-3 flex flex-wrap items-end gap-3"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">New status</span>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as Status)}
            className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Select...</option>
            <option value="REVIEWING">Reviewing</option>
            <option value="SHORTLISTED">Shortlisted</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={!selectedStatus || loading}
          className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
        >
          {loading ? "Updating..." : "Update"}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>
      )}
      {success && (
        <p role="status" className="mt-2 text-sm text-success">
          Status updated successfully.
        </p>
      )}
    </div>
  );
}
