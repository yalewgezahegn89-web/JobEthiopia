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
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
        Update Status
      </h3>
      <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          New status
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as Status)}
            className="rounded-md border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-800"
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
          className="rounded-md bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Updating..." : "Update"}
        </button>
      </form>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
      {success && (
        <p className="mt-2 text-sm text-green-600">Status updated successfully.</p>
      )}
    </div>
  );
}
