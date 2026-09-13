"use client";

import { useState, useTransition } from "react";
import type { CandidateApplicationListItem } from "@/lib/applications/dal";
import Link from "next/link";
import { ApplicationStatusBadge, getStatusLabel } from "@/components/applications/status-badge";
import { BuildingIcon, CalendarIcon, ArrowRightIcon } from "@/components/public/icons";

function resolveLabel(key: string, t: Record<string, unknown>): string {
  const parts = key.split(".");
  let obj: unknown = t;
  for (const p of parts) {
    if (obj && typeof obj === "object" && p in obj) {
      obj = (obj as Record<string, unknown>)[p];
    } else {
      return key;
    }
  }
  return typeof obj === "string" ? obj : key;
}

export function ApplicationHistory({
  items,
  t,
  locale = "en",
}: {
  items: CandidateApplicationListItem[];
  t: Record<string, unknown>;
  locale?: string;
}) {
  const applications = t.applications as Record<string, unknown>;
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

  const formatDateLocale = (value: string): string => {
    try {
      const intlLocale = locale === "am" ? "am-ET" : locale === "om" ? "om-ET" : "en-US";
      return new Intl.DateTimeFormat(intlLocale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(new Date(value));
    } catch {
      return value;
    }
  };

  if (historyItems.length === 0 && Object.keys(withdrawState).length === 0) {
    return (
      <div
        role="status"
        className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-raised text-primary">
          <BuildingIcon className="h-7 w-7" />
        </span>
        <h2 className="mt-5 text-xl font-bold text-foreground">
          {String(applications.emptyHeading)}
        </h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted">
          {String(applications.emptyBody)}
        </p>
        <Link
          href="/jobs"
          className="focus-visible:outline-2 mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {String(applications.browseJobs)}
        </Link>
      </div>
    );
  }

  return (
    <ul className="mt-6 space-y-4">
      {historyItems.map((item) => {
        const state = withdrawState[item.id];
        const isTerminal =
          item.status === "WITHDRAWN" || item.status === "REJECTED";
        return (
          <li
            key={item.id}
            className="rounded-xl border border-border bg-surface p-5 shadow-sm transition-all duration-200 hover:shadow-md"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold tracking-tight text-foreground">
                  <Link
                    href={`/applications/${item.id}`}
                    className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary hover:text-primary"
                  >
                    {item.jobTitle}
                  </Link>
                </h2>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                  <BuildingIcon className="h-3.5 w-3.5 text-subtle" />
                  {item.organizationName ?? "Unknown organization"}
                </p>
              </div>
              <ApplicationStatusBadge
                status={item.status}
                label={getStatusLabel(item.status, (key: string) => resolveLabel(key, t) as string)}
                className="shrink-0"
              />
            </div>

            <div className="mt-3 text-xs text-subtle">
              <span className="inline-flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" />
                {(applications.appliedDate as (d: string) => string)(formatDateLocale(item.createdAt))}
              </span>
              {item.status === "WITHDRAWN" && (
                <span className="ml-3 inline-flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {(applications.withdrawnDate as (d: string) => string)(formatDateLocale(item.updatedAt))}
                </span>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-3">
              <Link
                href={`/applications/${item.id}`}
                className="focus-visible:outline-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {String(applications.viewApplication)}
                <ArrowRightIcon className="h-4 w-4" />
              </Link>

              {item.status !== "WITHDRAWN" && state !== "done" && (
                <div className="flex items-center gap-3">
                  {state === "failed" && (
                    <span className="text-xs font-medium text-destructive">
                      {String(applications.withdrawFailed)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => withdraw(item.id)}
                    disabled={pending || state === "working"}
                    className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-muted transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {state === "working" ? String(applications.withdrawingCta) : String(applications.withdrawCta)}
                  </button>
                </div>
              )}
            </div>

            {isTerminal && (
              <p className="mt-2 text-xs text-subtle">
                {item.status === "REJECTED"
                  ? String(applications.closedRejected)
                  : String(applications.closedWithdrawn)}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
