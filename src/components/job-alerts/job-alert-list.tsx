"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { JobAlertRow } from "@/lib/jobAlerts/dal";

type JobAlertListProps = {
  items: JobAlertRow[];
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  UNSUBSCRIBED: "Unsubscribed",
  DISABLED: "Disabled",
};

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-success-light text-success",
  PAUSED: "bg-muted-light text-muted",
  UNSUBSCRIBED: "bg-subtle text-subtle",
  DISABLED: "bg-destructive/10 text-destructive",
};

export function JobAlertList({ items }: JobAlertListProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function mutate(url: string, method: string, body?: Record<string, unknown>) {
    startTransition(async () => {
      const res = await fetch(url, {
        method,
        ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
      });
      if (res.ok || res.status === 204) {
        router.refresh();
      }
    });
  }

  if (items.length === 0) {
    return (
      <section
        role="status"
        className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center"
      >
        <p className="text-lg font-bold text-foreground">
          No job alerts yet
        </p>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted">
          Create an alert and we&apos;ll email you when matching jobs are
          published.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 space-y-4">
      {items.map((alert) => (
        <article
          key={alert.id}
          className="rounded-xl border border-border bg-surface-raised p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-foreground">
                {alert.name}
              </h3>
              <p className="mt-1 text-sm text-muted">
                {alert.keywords
                  ? `Keywords: ${alert.keywords}`
                  : "Any job"}
                {" · "}
                {alert.frequency === "INSTANT" ? "Instant" : "Daily"}
              </p>
            </div>

            <span
              className={`inline-block rounded-full px-3 py-0.5 text-xs font-semibold ${
                STATUS_STYLE[alert.status] ?? "bg-muted-light text-muted"
              }`}
            >
              {STATUS_LABEL[alert.status] ?? alert.status}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                mutate(
                  `/api/job-alerts/${alert.id}`,
                  "PATCH",
                  { status: alert.status === "ACTIVE" ? "PAUSED" : "ACTIVE" },
                )
              }
              className="rounded-md bg-surface px-3 py-1.5 font-semibold text-primary shadow-sm hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-60"
            >
              {alert.status === "ACTIVE" ? "Pause" : "Resume"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!window.confirm("Delete this alert?")) return;
                mutate(`/api/job-alerts/${alert.id}`, "DELETE");
              }}
              className="rounded-md bg-surface px-3 py-1.5 font-semibold text-destructive shadow-sm hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Delete
            </button>
            <span className="rounded-md bg-surface px-3 py-1.5 text-subtle">
              {alert.lastSentAt
                ? `Last sent ${new Date(alert.lastSentAt).toLocaleDateString()}`
                : "Not sent yet"}
            </span>
          </div>
        </article>
      ))}
    </section>
  );
}