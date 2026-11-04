"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { NotificationItem } from "./notification-item";

export type ClientNotification = {
  id: string;
  userId: string;
  type: string;
  data: unknown;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

type Props = {
  items: ClientNotification[];
};

export function NotificationList({ items }: Props) {
  const { t } = useI18n();
  const [rows, setRows] = useState(items);
  const [processingId, setProcessingId] = useState<string | null>(null);

  async function handleMarkRead(id: string) {
    if (processingId) return;
    setProcessingId(id);
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        setRows((prev) =>
          prev.map((r) =>
            r.id === id ? { ...r, readAt: new Date().toISOString() } : r,
          ),
        );
      }
    } finally {
      setProcessingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (processingId) return;
    setProcessingId(id);
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setRows((prev) => prev.filter((r) => r.id !== id));
      }
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <ul className="mt-6 divide-y divide-border" role="list">
      {rows.map((item) => (
        <NotificationItem
          key={item.id}
          item={item}
          t={t.notifications}
          onMarkRead={handleMarkRead}
          onDelete={handleDelete}
          disabled={processingId !== null && processingId !== item.id}
        />
      ))}
    </ul>
  );
}
