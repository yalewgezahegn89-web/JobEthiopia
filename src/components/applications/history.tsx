"use client";

import { useState, useTransition } from "react";
import type { CandidateApplicationListItem } from "@/lib/applications/dal";
import Link from "next/link";

export function ApplicationHistory({
  items,
}: {
  items: CandidateApplicationListItem[];
}) {
  const [withdrawState, setWithdrawState] = useState<
    Record<string, "working" | "done" | "failed">
  >({});
  const [pending, startTransition] = useTransition();

  function withdraw(id: string) {
    startTransition(async () => {
      setWithdrawState((s) => ({ ...s, [id]: "working" }));
      try {
        const res = await fetch(`/api/applications/${id}`, { method: "POST" });
        if (res.ok) {
          setWithdrawState((s) => ({ ...s, [id]: "done" }));
        } else {
          setWithdrawState((s) => ({ ...s, [id]: "failed" }));
        }
      } catch {
        setWithdrawState((s) => ({ ...s, [id]: "failed" }));
      }
    });
  }

  const historyItems = items.filter((item) => withdrawState[item.id] !== "done");

  if (historyItems.length === 0 && Object.keys(withdrawState).length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 p-8 text-center dark:border-gray-800">
        <p className="text-gray-600 dark:text-gray-300">
          You have not applied to any jobs yet.
        </p>
        <Link
          href="/jobs"
          className="mt-4 inline-block font-semibold text-blue-600 underline dark:text-blue-400"
        >
          Browse jobs
        </Link>
      </div>
    );
  }

  return (
    <ul className="mt-4 space-y-3">
      {historyItems.map((item) => {
        const state = withdrawState[item.id];
        return (
          <li
            key={item.id}
            className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-4 dark:border-gray-800"
          >
            <div>
              <Link
                href={`/jobs/${item.jobId}`}
                className="font-semibold text-blue-700 hover:underline dark:text-blue-400"
              >
                {item.jobTitle}
              </Link>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                {item.organizationName ?? "Unknown organization"}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Applied {formatDate(item.createdAt)}
                {item.status === "WITHDRAWN" &&
                  ` · Withdrawn ${formatDate(item.updatedAt)}`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="inline-flex rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                {item.status}
              </span>
              {item.status !== "WITHDRAWN" && state !== "done" && (
                <button
                  type="button"
                  onClick={() => withdraw(item.id)}
                  disabled={pending || state === "working"}
                  className="rounded-md border border-red-300 px-3 py-1 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                >
                  {state === "working" ? "Withdrawing…" : "Withdraw"}
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
