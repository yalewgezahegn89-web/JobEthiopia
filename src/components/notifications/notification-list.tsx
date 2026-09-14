"use client";

import { useState } from "react";
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

type NotificationMessages = {
  typeApplicationStatusChanged: string;
  typeJobAlertMatch: string;
  typeEmployerNewApplication: string;
  typeEmployerApplicationWithdrawn: string;
  typeEmployerJobStatusChanged: string;
  statusSubheading: (jobTitle: string, status: string) => string;
  alertMatchSubheading: (count: number, alertName: string) => string;
  employerNewApplicationSubheading: (jobTitle: string, candidateName: string) => string;
  employerApplicationWithdrawnSubheading: (jobTitle: string, candidateName: string) => string;
  employerJobStatusSubheading: (jobTitle: string, status: string) => string;
  viewApplication: string;
  viewJob: string;
  markRead: string;
  delete: string;
  unreadLabel: string;
  readLabel: string;
};

type Props = {
  items: ClientNotification[];
  t: NotificationMessages;
};

export function NotificationList({ items, t }: Props) {
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
          t={t}
          onMarkRead={handleMarkRead}
          onDelete={handleDelete}
          disabled={processingId !== null && processingId !== item.id}
        />
      ))}
    </ul>
  );
}
