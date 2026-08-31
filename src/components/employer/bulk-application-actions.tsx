"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type BulkApplicationRow = {
  id: string;
  jobId: string;
  jobTitle: string;
  organizationName: string;
  candidateName: string;
  candidateEmail: string;
  status: string;
  createdAt: string;
};

const SELECTABLE = new Set(["SUBMITTED", "REVIEWING"]);

const SOURCE_TARGETS: Record<string, string[]> = {
  SUBMITTED: ["REVIEWING", "SHORTLISTED", "REJECTED"],
  REVIEWING: ["SHORTLISTED", "REJECTED"],
};

/**
 * Computes the INTERSECTION of valid target statuses for the given selection
 * of application statuses. The server remains authoritative; this only drives
 * which actions the UI offers.
 */
export function computeAllowedTargets(statuses: string[]): string[] {
  if (statuses.length === 0) return [];
  let allowed: string[] | null = null;
  for (const s of statuses) {
    const targets = SOURCE_TARGETS[s] ?? [];
    allowed = allowed === null ? targets : allowed.filter((t) => targets.includes(t));
  }
  const order = ["REVIEWING", "SHORTLISTED", "REJECTED"];
  return order.filter((t) => allowed?.includes(t) ?? false);
}

function statusBadge(s: string) {
  const colors: Record<string, string> = {
    SUBMITTED: "bg-blue-100 text-blue-800",
    WITHDRAWN: "bg-gray-100 text-gray-600",
    REVIEWING: "bg-yellow-100 text-yellow-800",
    SHORTLISTED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-800",
  };
  return colors[s] ?? "bg-gray-100 text-gray-600";
}

export function BulkApplicationActions({
  applications,
}: {
  applications: BulkApplicationRow[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectableRows = applications.filter((a) => SELECTABLE.has(a.status));
  const selectedRows = applications.filter((a) => selected.has(a.id));
  const selectedCount = selectedRows.length;
  const allowedTargets = computeAllowedTargets(selectedRows.map((a) => a.status));
  const allSelectedOnPage =
    selectableRows.length > 0 && selectableRows.every((a) => selected.has(a.id));

  function toggle(id: string, status: string) {
    setSuccess(null);
    setError(null);
    if (!SELECTABLE.has(status)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSuccess(null);
    setError(null);
    if (allSelectedOnPage) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableRows.map((a) => a.id)));
    }
    setTarget("");
  }

  function clearSelection() {
    setSelected(new Set());
    setTarget("");
    setConfirming(false);
    setSuccess(null);
    setError(null);
  }

  function handleApply() {
    setError(null);
    setSuccess(null);
    if (selectedCount === 0 || !target) return;
    setConfirming(true);
  }

  async function confirmSubmit() {
    if (!target || selectedCount === 0) return;
    setPending(true);
    setConfirming(false);
    setError(null);
    setSuccess(null);
    const ids = selectedRows.map((a) => a.id);
    try {
      const res = await fetch("/api/employer/applications/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationIds: ids, status: target }),
      });
      if (!res.ok) {
        let message = "Some selected applications can no longer be updated. Refresh and try again.";
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
        } catch {
          message = "Some selected applications can no longer be updated. Refresh and try again.";
        }
        setError(message);
        router.refresh();
        return;
      }
      setSuccess(`Updated ${selectedCount} application${selectedCount === 1 ? "" : "s"}.`);
      setSelected(new Set());
      setTarget("");
      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const confirmLabel =
    target === "REJECTED"
      ? `Reject ${selectedCount} application${selectedCount === 1 ? "" : "s"}?`
      : target === "SHORTLISTED"
        ? `Shortlist ${selectedCount} application${selectedCount === 1 ? "" : "s"}?`
        : target === "REVIEWING"
          ? `Move ${selectedCount} application${selectedCount === 1 ? "" : "s"} to review?`
          : "";

  return (
    <div>
      <div
        className={`mt-4 rounded-lg border p-3 ${
          selectedCount > 0
            ? "border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/40"
            : "border-transparent"
        }`}
      >
        {selectedCount > 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-gray-700 dark:text-gray-200">
              {selectedCount} selected
            </span>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-300">
                Change status to
              </span>
              <select
                value={target}
                onChange={(e) => {
                  setTarget(e.target.value);
                  setSuccess(null);
                  setError(null);
                }}
                className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800"
              >
                <option value="">Select...</option>
                {allowedTargets.map((t) => (
                  <option key={t} value={t}>
                    {t === "REVIEWING"
                      ? "Reviewing"
                      : t === "SHORTLISTED"
                        ? "Shortlisted"
                        : "Rejected"}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={handleApply}
              disabled={!target || pending}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300"
            >
              Clear selection
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Select applications to update their status in bulk.
          </p>
        )}
        {allowedTargets.length === 0 && selectedCount > 0 && (
          <p className="mt-2 text-xs text-gray-500">
            The selected applications cannot be moved to the same status.
          </p>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {success && <p className="mt-2 text-sm text-green-600">{success}</p>}
      </div>

      {confirming && target && (
        <div className="mt-4 rounded-lg border border-gray-300 p-4 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {confirmLabel}
          </p>
          {target === "REJECTED" ? (
            <p className="mt-1 text-sm text-red-600">
              Rejected applications cannot be moved back to another status.
            </p>
          ) : null}
          <p className="mt-1 text-xs text-gray-500">
            Candidates will be notified by email.
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={confirmSubmit}
              disabled={pending}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {pending ? "Updating..." : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <ul className="mt-3 space-y-2">
        {applications.map((item) => {
          const selectable = SELECTABLE.has(item.status);
          const checked = selected.has(item.id);
          return (
            <li
              key={item.id}
              className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    aria-label={`Select application ${item.jobTitle}`}
                    checked={checked}
                    disabled={!selectable}
                    onChange={() => toggle(item.id, item.status)}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={`/organization/applications/${item.id}`}
                        className="font-medium text-gray-900 hover:underline dark:text-gray-100"
                      >
                        {item.jobTitle}
                      </a>
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(item.status)}`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {item.candidateName} &middot; {item.candidateEmail}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {item.organizationName}
                    </div>
                  </div>
                </div>
                <div className="text-right text-xs text-gray-500">
                  <div>{new Date(item.createdAt).toLocaleDateString()}</div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex items-center gap-3">
        <input
          type="checkbox"
          id="bulk-select-all"
          checked={allSelectedOnPage}
          onChange={toggleAll}
          disabled={selectableRows.length === 0}
        />
        <label htmlFor="bulk-select-all" className="text-sm text-gray-700 dark:text-gray-200">
          Select all on this page
        </label>
      </div>
    </div>
  );
}
