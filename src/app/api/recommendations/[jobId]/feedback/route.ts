/**
 * Recommendation feedback API route.
 *
 * Allows candidates to submit structured feedback (relevant, not_relevant,
 * hidden) on individual job recommendations. Uses upsert semantics — one
 * feedback record per user per job. Hidden jobs are excluded from future
 * recommendations.
 *
 * Security: candidate-owned, session-resolved identity, CSRF-protected.
 */
import { NextResponse, type NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { recommendationFeedback } from "@/db/schema/recommendationFeedback";
import { getCurrentUser } from "@/lib/auth/context";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";
import { verifySession } from "@/lib/auth/session";
import { trackMatchEvent } from "@/lib/analytics/matchingEvents";
import { cookies } from "next/headers";

const VALID_FEEDBACK_TYPES = ["relevant", "not_relevant", "hidden"] as const;
type FeedbackType = (typeof VALID_FEEDBACK_TYPES)[number];

function isValidFeedbackType(value: unknown): value is FeedbackType {
  return typeof value === "string" && (VALID_FEEDBACK_TYPES as readonly string[]).includes(value);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cookieStore = await cookies();
  const rawToken = cookieStore.get("session")?.value ?? "";
  const user = rawToken ? await verifySession(rawToken) : null;
  if (!user || user.role !== "CANDIDATE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await params;

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      jobId,
    )
  ) {
    return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
  }

  let body: { feedback?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isValidFeedbackType(body.feedback)) {
    return NextResponse.json(
      { error: "Invalid feedback type. Must be: relevant, not_relevant, or hidden" },
      { status: 400 },
    );
  }

  // Upsert: one feedback per user per job
  const existing = await db
    .select({ id: recommendationFeedback.id })
    .from(recommendationFeedback)
    .where(
      and(
        eq(recommendationFeedback.userId, user.id),
        eq(recommendationFeedback.jobId, jobId),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(recommendationFeedback)
      .set({
        feedbackType: body.feedback,
        updatedAt: new Date(),
      })
      .where(eq(recommendationFeedback.id, existing[0].id));
  } else {
    await db.insert(recommendationFeedback).values({
      userId: user.id,
      jobId,
      feedbackType: body.feedback,
    });
  }

  // Best-effort analytics (never blocks response)
  await trackMatchEvent({
    event: "match_feedback_submitted",
    metadata: { feedbackType: body.feedback },
  });

  return NextResponse.json({ ok: true, feedback: body.feedback });
}
