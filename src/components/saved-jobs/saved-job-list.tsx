"use client";

import { useState, useTransition } from "react";
import type { SavedJobListItem } from "@/lib/savedJobs/dal";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  PinIcon,
  CalendarIcon,
  SaveIcon,
} from "@/components/public/icons";

type SaveState =
  | { kind: "active" }
  | { kind: "closing" }
  | { kind: "expired" }
  | { kind: "removed" };

function saveState(item: SavedJobListItem): SaveState {
  if (item.jobStatus === "REMOVED") return { kind: "removed" };
  if (item.jobStatus === "EXPIRED") return { kind: "expired" };
  const closingSoon =
    item.deadline != null &&
    new Date(item.deadline).getTime() - Date.now() <= 7 * 24 * 60 * 60 * 1000;
  if (closingSoon) return { kind: "closing" };
  return { kind: "active" };
}

function saveStateVisual(state: SaveState): {
  rail: string;
  iconClass: string;
} {
  switch (state.kind) {
    case "expired":
      return { rail: "bg-destructive", iconClass: "text-destructive" };
    case "closing":
      return { rail: "bg-accent", iconClass: "text-warning" };
    case "removed":
      return { rail: "bg-border", iconClass: "text-subtle" };
    default:
      return { rail: "bg-primary", iconClass: "text-primary" };
  }
}

function saveStateBadge(state: SaveState) {
  switch (state.kind) {
    case "active":
      return <Badge variant="success">Active</Badge>;
    case "closing":
      return <Badge variant="warning">Closing soon</Badge>;
    case "expired":
      return <Badge variant="destructive">Expired</Badge>;
    case "removed":
      return <Badge variant="default">No longer available</Badge>;
  }
}

function orgInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
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

  if (visible.length === 0) {
    return (
      <div
        role="status"
        className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light text-primary">
          <SaveIcon className="h-7 w-7" />
        </span>
        <h2 className="mt-5 text-xl font-bold text-foreground">
          Your saved jobs will appear here
        </h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted">
          Save opportunities while you browse and come back to them later.
        </p>
        <Link
          href="/jobs"
          className="focus-visible:outline-2 mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Browse jobs
        </Link>
      </div>
    );
  }

  return (
    <ul className="mt-6 space-y-4">
      {visible.map((item) => {
        const state = saveState(item);
        const visual = saveStateVisual(state);
        const muted = state.kind === "removed" || state.kind === "expired";
        return (
          <li
            key={item.id}
            className="relative rounded-xl border border-border bg-surface shadow-sm transition-all duration-200 hover:shadow-md"
          >
            <span
              aria-hidden="true"
              className={`absolute inset-y-0 left-0 w-1 rounded-l-xl ${visual.rail}`}
            />
            <div className="flex flex-wrap items-start justify-between gap-4 py-5 pr-5 pl-6">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-light text-[10px] font-bold text-primary">
                    {orgInitials(item.organizationName)}
                  </span>
                  <span className="truncate text-sm font-medium text-muted">
                    {item.organizationName ?? "Unknown organization"}
                  </span>
                  <span
                    className={`ml-auto inline-flex items-center gap-1 text-xs text-subtle ${
                      state.kind === "active" || state.kind === "closing"
                        ? "sm:hidden"
                        : ""
                    }`}
                  >
                    <CalendarIcon className="h-3.5 w-3.5" />
                    Saved {formatDate(item.savedAt)}
                  </span>
                </div>

                <h2
                  className={`mt-2 line-clamp-2 text-lg font-semibold leading-snug tracking-tight ${
                    muted ? "text-muted" : "text-foreground"
                  }`}
                >
                  <Link
                    href={`/jobs/${item.jobId}`}
                    className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary hover:text-primary"
                  >
                    {item.title}
                  </Link>
                </h2>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                  {item.locationName && (
                    <span className="inline-flex items-center gap-1.5">
                      <PinIcon className="h-4 w-4 text-subtle" />
                      {item.locationName}
                    </span>
                  )}
                  {item.deadline && (
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarIcon className="h-4 w-4 text-subtle" />
                      Deadline:{" "}
                      <time>{formatDate(item.deadline)}</time>
                    </span>
                  )}
                </div>
              </div>

              <div className="shrink-0">
                <span
                  className={`inline-flex items-center gap-1 text-xs text-subtle ${
                    state.kind === "active" || state.kind === "closing"
                      ? "hidden sm:inline-flex"
                      : "hidden"
                  }`}
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                  Saved {formatDate(item.savedAt)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-6 py-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {saveStateBadge(state)}
              </div>
              <button
                type="button"
                onClick={() => unsave(item.jobId)}
                disabled={pending || removedIds.has(item.jobId)}
                className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-muted transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                Remove
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}