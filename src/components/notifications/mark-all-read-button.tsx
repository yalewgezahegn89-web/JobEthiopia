"use client";

import { useState } from "react";

type Props = {
  t: { markAllRead: string; markAllReadSuccess: string };
};

export function MarkAllReadButton({ t }: Props) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/notifications/read-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        setDone(true);
        window.location.reload();
      }
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <span className="text-sm font-medium text-green-600">
        {t.markAllReadSuccess}
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={handleClick}
      className="focus-visible:outline-2 inline-flex shrink-0 items-center rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition-all duration-200 hover:bg-surface-raised hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
    >
      {loading ? "..." : t.markAllRead}
    </button>
  );
}
