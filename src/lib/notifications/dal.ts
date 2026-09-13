/**
 * Notification DAL (Batch 4 — Notifications Inbox).
 *
 * All functions take an explicit `userId` from the authenticated session.
 * Every query is scoped by user_id. Cross-user access is impossible by design.
 */

import { eq, and, desc, sql, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema/notifications";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const NOTIFICATION_PAGE_LIMIT = 50;

export type NotificationRow = typeof notifications.$inferSelect;

export type NotificationList = {
  items: NotificationRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  unreadCount: number;
};

export type CreateNotificationInput = {
  userId: string;
  type: string;
  data?: Record<string, unknown> | null;
  actionUrl?: string | null;
};

/**
 * Creates a notification for a user. Best-effort — never throws.
 *
 * `actionUrl` must be a relative path (starts with "/", no "://").
 * `type` must be non-empty. Data values are shallow-sanitized.
 */
export async function createNotification(
  input: CreateNotificationInput,
): Promise<NotificationRow | null> {
  if (!input.userId || !input.type) return null;

  let actionUrl = input.actionUrl ?? null;
  if (actionUrl && (!actionUrl.startsWith("/") || /:\/\//.test(actionUrl))) {
    actionUrl = null;
  }

  const sanitizedData = input.data ? sanitizeData(input.data) : null;

  try {
    const [row] = await db
      .insert(notifications)
      .values({
        userId: input.userId,
        type: input.type,
        data: sanitizedData,
        actionUrl,
      })
      .returning();
    return row ?? null;
  } catch {
    return null;
  }
}

/**
 * Shallow-sanitize string values in a JSONB data payload.
 * Strips HTML tags and trims to 500 chars. Non-string values pass through.
 */
function sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string") {
      out[key] = value.replace(/<[^>]*>/g, "").trim().slice(0, 500);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Lists notifications for a user, newest first. Bounded pagination.
 */
export async function listNotifications(
  userId: string,
  query: { page?: number; limit?: number } = {},
): Promise<NotificationList> {
  if (!userId) {
    return { items: [], page: 1, limit: NOTIFICATION_PAGE_LIMIT, total: 0, totalPages: 1, unreadCount: 0 };
  }

  const page = Math.max(1, Math.trunc(query.page ?? 1));
  const limit = Math.min(
    NOTIFICATION_PAGE_LIMIT,
    Math.max(1, Math.trunc(query.limit ?? 20)),
  );
  const offset = (page - 1) * limit;

  const where = eq(notifications.userId, userId);

  const [rows, totalRows, unreadRows] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(where),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(where, isNull(notifications.readAt))),
  ]);

  const total = totalRows[0]?.count ?? 0;
  const unreadCount = unreadRows[0]?.count ?? 0;

  return {
    items: rows,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    unreadCount,
  };
}

/**
 * Returns the unread notification count for a user.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  if (!userId) return 0;

  try {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return result?.count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Marks a single notification as read. Only touches rows owned by the user.
 * Returns true if a row was updated.
 */
export async function markNotificationRead(
  notificationId: string,
  userId: string,
): Promise<boolean> {
  if (!notificationId || !userId) return false;
  if (!UUID_PATTERN.test(notificationId)) return false;

  try {
    const rows = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId),
          isNull(notifications.readAt),
        ),
      )
      .returning({ id: notifications.id });
    return rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * Marks all unread notifications for a user as read.
 * Returns the count of newly read notifications.
 */
export async function markAllNotificationsRead(
  userId: string,
): Promise<number> {
  if (!userId) return 0;

  try {
    const where = and(
      eq(notifications.userId, userId),
      isNull(notifications.readAt),
    );

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(where);

    const count = countResult?.count ?? 0;
    if (count === 0) return 0;

    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(where);

    return count;
  } catch {
    return 0;
  }
}

/**
 * Deletes a single notification. Only touches rows owned by the user.
 * Returns true if a row was deleted.
 */
export async function deleteNotification(
  notificationId: string,
  userId: string,
): Promise<boolean> {
  if (!notificationId || !userId) return false;
  if (!UUID_PATTERN.test(notificationId)) return false;

  try {
    const rows = await db
      .delete(notifications)
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId),
        ),
      )
      .returning({ id: notifications.id });
    return rows.length > 0;
  } catch {
    return false;
  }
}
