"use client";

import { useState, useTransition } from "react";
import type { SavedJobListItem } from "@/lib/savedJobs/dal";
import Link from "next/link";

export function SavedJobList({
  items,
}: {
  items: SavedJobListItem[];
}) {
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  function unsave(id: string) {
    startTransition(async () => {
      setRemovedIds((s) => new Set(s).add(id));
      try {
        const res = await fetch(`/api/saved-jobs/${id}`, { method: "DELETE" });
        if (!res.ok) {
          setRemovedIds((s) => {
            const next = new Set(s);
            next.delete(id);
            return next;
          });
        }
      } catch {
        setRemovedIds((s) => {
          const next = new Set(s);
          next.delete(id);
          return next;
        });
      }
    });
  }

  const visible = items.filter((item) => !removedIds.has(item.jobId));

  if (visible.length === 0 && removedIds.size === items.length) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
        <p className="text-gray-600 dark:text-gray-300">
          You have no saved jobs yet.
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
      {visible.map((item) => (
        <li
          key={item.id}
          className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-4 dark:border-gray-800"
        >
          <div className="min-w-0 flex-1">
            <Link
              href={`/jobs/${item.jobId}`}
              className="font-semibold text-blue-700 hover:underline dark:text-blue-400"
            >
              {item.title}
            </Link>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              {item.organizationName ?? "Unknown organization"}
            </p>
            <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
              {item.locationName && <span>{item.locationName}</span>}
              {item.deadline && (
                <span>
                  Deadline:{" "}
                  <time>
                    {new Date(item.deadline).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                </span>
              )}
              <span>
                Saved {new Date(item.savedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {item.jobStatus === "EXPIRED" && (
                <span className="rounded-md bg-red-100 px-2 py-0.5 font-semibold text-red-800 dark:bg-red-900 dark:text-red-200">
                  Expired
                </span>
              )}
              {item.jobStatus === "REMOVED" && (
                <span className="rounded-md bg-gray-100 px-2 py-0.5 font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                  No longer available
                </span>
              )}
              {item.jobStatus === "PUBLISHED" && (
                <span className="rounded-md bg-green-100 px-2 py-0.5 font-semibold text-green-800 dark:bg-green-900 dark:text-green-200">
                  Active
                </span>
              )}
            </div>
          </div>
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => unsave(item.jobId)}
              disabled={pending || removedIds.has(item.jobId)}
              className="rounded-md border border-red-300 px-3 py-1 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
            >
              Remove
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
