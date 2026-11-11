"use server";

/**
 * Admin job moderation server actions (Batch 51, Batch 7 — Employer L1).
 *
 * Security order enforced in every action:
 *   1. Authenticate the session
 *   2. Authorize the role (staff only)
 *   3. Validate the CSRF / trusted origin
 *   4. Validate the target id + action enum (closed set)
 *   5. Load the target job
 *   6. Validate the allowed transition (single authoritative table)
 *   7. Perform the update + audit row atomically
 *   8. Return a safe result
 *
 * Identity (actorUserId) always comes from the authenticated session; the
 * client can never supply an actor id, a role, a status, or a timestamp.
 */
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireStaffAdmin } from "@/lib/auth/context";
import { assertTrustedCsrfFromRequest, CsrfError } from "@/lib/auth/csrf";
import { moderateJob, type ModerationAction } from "@/lib/admin/jobs";
import { dispatchInstantAlertsForJob } from "@/lib/jobAlerts/delivery";
import { notifyEmployerJobStatusChanged } from "@/lib/notifications/events";
import { db } from "@/db";
import { jobs } from "@/db/schema/jobs";
import { organizationMembers } from "@/db/schema/organizationMembers";
import {
  createCuratedJob,
  type CuratedJobDuplicateWarning,
  type CuratedJobResult,
} from "@/lib/admin/curatedJobs";
import { curatedCreateJobSchema } from "@/lib/validations/curatedJob";
import {
  publishJobToOwnedFacebookPage,
  type FacebookPublishReason,
} from "@/lib/facebook/publishing";
import { redactFacebookSecrets } from "@/lib/facebook/config";

export type ModerationActionResult = {
  ok: boolean;
  error?: string;
};

const ACTION_ENUM: readonly ModerationAction[] = [
  "PUBLISH",
  "REJECT",
  "MARK_INVALID",
  "REQUEST_REVIEW",
  "REVERIFY",
];

const GENERIC_ERROR = "Unable to update this job. Please try again.";

function isModerationAction(value: string): value is ModerationAction {
  return (ACTION_ENUM as readonly string[]).includes(value);
}

export async function moderateJobAction(
  _prevState: ModerationActionResult,
  formData: FormData,
): Promise<ModerationActionResult> {
  const jobId = String(formData.get("jobId") ?? "");
  const actionRaw = String(formData.get("action") ?? "");

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)) {
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!isModerationAction(actionRaw)) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin/jobs");
  }
  const actor = guard.user;

  try {
    await assertTrustedCsrfFromRequest();
  } catch (err) {
    if (err instanceof CsrfError) {
      return { ok: false, error: GENERIC_ERROR };
    }
    return { ok: false, error: GENERIC_ERROR };
  }

  let result: Awaited<ReturnType<typeof moderateJob>> | null = null;
  try {
    result = await moderateJob(jobId, actionRaw, actor.id);
    if (!result.ok) {
      return { ok: false, error: GENERIC_ERROR };
    }
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }

  // Instant job alerts fire on the one true "became public" event: an admin
  // moderation that moved the job to PUBLISHED. Fire-and-forget — a delivery
  // problem must never fail a publish.
  if (
    actionRaw === "PUBLISH" &&
    result?.ok &&
    result.state?.toStatus === "PUBLISHED"
  ) {
    try {
      await dispatchInstantAlertsForJob(jobId);
    } catch {
      // Intentionally swallowed: publishing must not depend on alerts.
    }
  }

  // Notify employer members about job moderation status changes
  if (result?.ok && result.state?.toStatus) {
    try {
      const jobRow = await db
        .select({
          title: jobs.title,
          organizationId: jobs.organizationId,
        })
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1);

      if (jobRow.length > 0 && jobRow[0].organizationId) {
        const employerMembers = await db
          .select({ userId: organizationMembers.userId })
          .from(organizationMembers)
          .where(eq(organizationMembers.organizationId, jobRow[0].organizationId));

        for (const member of employerMembers) {
          await notifyEmployerJobStatusChanged({
            employerUserId: member.userId,
            jobId,
            jobTitle: jobRow[0].title,
            newStatus: result.state.toStatus,
          });
        }
      }
    } catch {
      // Employer notification failure must not affect the moderation response.
    }
  }

  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*  Manual Facebook Page publishing                                            */
/* -------------------------------------------------------------------------- */

export type FacebookPublishActionResult = {
  ok: boolean;
  error?: string;
  /** Remote Facebook post id, present only on a confirmed success. */
  postId?: string;
  /**
   * Machine-readable outcome for the UI. UNKNOWN means the request result is
   * unclear and must not be retried automatically.
   */
  outcome?: "PUBLISHED" | "FAILED" | "UNKNOWN";
};

const JOB_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FACEBOOK_PUBLISH_REASONS: Record<
  FacebookPublishReason,
  string
> = {
  PUBLISHED: "Published to Facebook.",
  FORBIDDEN: "You are not allowed to publish to Facebook.",
  NOT_FOUND: "Unable to publish this job. Please try again.",
  FACEBOOK_PUBLISHING_DISABLED:
    "Facebook publishing is not enabled on this deployment.",
  LIVE_PUBLISHING_DISABLED:
    "Live Facebook publishing is disabled outside Production.",
  NOT_CONFIGURED: "Facebook publishing is not configured on this deployment.",
  JOB_NOT_PUBLISHED_VERIFIED:
    "Only jobs that are already published and verified can be shared to Facebook.",
  DEADLINE_EXPIRED: "This vacancy has expired and cannot be shared.",
  ELIGIBILITY_NOT_CONFIRMED:
    "Applicant eligibility must be explicitly confirmed before sharing.",
  UNSAFE_URL: "The job URL is not safe to publish.",
  CONTENT_AUTHORIZATION_REQUIRED:
    "You must confirm JobEthiopia's right to redistribute this listing.",
  NO_PROVENANCE: "This job has no recorded source provenance.",
  FACEBOOK_APPROVAL_REQUIRED:
    "A Facebook source for this job lacks Meta Page Public Content Access approval.",
  FACEBOOK_CONTENT_USE_NOT_AUTHORIZED:
    "A Facebook source for this job lacks documented content-use authorization.",
  DUPLICATE_IN_PROGRESS:
    "A publish attempt for this job is already in progress.",
  DUPLICATE_ALREADY_PUBLISHED:
    "This job has already been published to the Facebook Page.",
  DUPLICATE_UNKNOWN_OUTCOME:
    "A previous attempt had an unclear result and needs manual review before this job can be published again.",
  GRAPH_REJECTED: "Facebook rejected the post.",
  UNKNOWN_OUTCOME:
    "The result of the Facebook request is unclear. The attempt was recorded as UNKNOWN and must be reviewed manually.",
};

/**
 * Publishes an existing job to the JobEthiopia-owned Facebook Page.
 *
 * Security order:
 *   1. Authenticate the session (staff area)
 *   2. Validate the CSRF / trusted origin
 *   3. Validate the job id and the confirmation checkbox
 *   4. Delegate to publishJobToOwnedFacebookPage(), which re-checks the
 *      administrator role (ADMIN/SUPER_ADMIN), the dedicated feature flag,
 *      the token, every job safety gate, and durable duplicate protection
 *   5. Return a safe result (never the Page access token)
 *
 * The destination Page, the post text, and the requesting administrator are
 * all resolved server-side; the client can supply only the job id and the
 * rights confirmation.
 */
export async function publishJobToFacebookAction(
  _prevState: FacebookPublishActionResult,
  formData: FormData,
): Promise<FacebookPublishActionResult> {
  const jobId = String(formData.get("jobId") ?? "");
  if (!JOB_ID_PATTERN.test(jobId)) {
    return { ok: false, error: FACEBOOK_PUBLISH_REASONS.NOT_FOUND };
  }

  const confirmed =
    formData.get("confirmContentRights") === "on" ||
    formData.get("confirmContentRights") === "true" ||
    formData.get("confirmContentRights") === "1";

  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin/jobs");
  }
  const actor = guard.user;

  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    return { ok: false, error: FACEBOOK_PUBLISH_REASONS.NOT_FOUND };
  }

  if (!confirmed) {
    return {
      ok: false,
      error: FACEBOOK_PUBLISH_REASONS.CONTENT_AUTHORIZATION_REQUIRED,
    };
  }

  let result: Awaited<ReturnType<typeof publishJobToOwnedFacebookPage>>;
  try {
    result = await publishJobToOwnedFacebookPage(actor, jobId, {
      contentRightsConfirmed: confirmed,
    });
  } catch {
    return { ok: false, error: FACEBOOK_PUBLISH_REASONS.NOT_FOUND };
  }

  if (result.published) {
    return {
      ok: true,
      postId: result.postId,
      outcome: "PUBLISHED",
    };
  }

  const base = FACEBOOK_PUBLISH_REASONS[result.reason] ?? FACEBOOK_PUBLISH_REASONS.NOT_FOUND;
  // Any error detail was already redacted server-side; redact again as
  // defense in depth before it reaches the admin UI.
  const detail = result.error
    ? ` ${redactFacebookSecrets(result.error)}`
    : "";

  return {
    ok: false,
    error: `${base}${detail}`,
    outcome:
      result.reason === "UNKNOWN_OUTCOME"
        ? "UNKNOWN"
        : result.reason === "PUBLISHED"
          ? "PUBLISHED"
          : "FAILED",
  };
}

/* -------------------------------------------------------------------------- */
/*  Curated / manual job creation (Phase 6 Batch 2)                           */
/* -------------------------------------------------------------------------- */

export type CreateCuratedJobActionResult = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  itemId?: string;
  warning?: CuratedJobDuplicateWarning;
};

const CREATE_GENERIC_ERROR = "Unable to create this job. Please try again.";
const CREATE_SLUG_ERROR =
  "A job with a similar title already exists. Try a slightly different title.";

function readText(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readNumber(formData: FormData, key: string): number | undefined {
  const value = readText(formData, key);
  if (value === undefined) return undefined;
  return Number(value);
}

/**
 * Creates a curated/manual job from the staff data-entry form.
 *
 * Security order:
 *   1. Authenticate the session
 *   2. Authorize the role (staff only, same set as createCuratedJob)
 *   3. Validate the CSRF / trusted origin
 *   4. Validate input with the authoritative curatedCreateJobSchema (the
 *      employer contract plus the optional verified original-source block)
 *   5. Delegate to createCuratedJob() (which re-validates and enforces the
 *      Manual source resolution server-side)
 *   6. Navigate to the created job detail page (never auto-publishes)
 *
 * The action only ever reads the whitelisted form fields below. A
 * client-supplied sourceId, status, or verificationStatus is never read, so
 * it can never influence provenance or the initial DRAFT/PENDING state. The
 * optional original source (site name, official URL, employer reference) is
 * passed through to the service, which resolves-or-creates the WEBSITE source
 * server-side by its stable name. On success the app redirects to the admin
 * job detail page where the existing moderation workflow takes over.
 */
export async function createCuratedJobAction(
  _prevState: CreateCuratedJobActionResult,
  formData: FormData,
): Promise<CreateCuratedJobActionResult> {
  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin/jobs");
  }
  const actor = guard.user;

  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    return { ok: false, error: CREATE_GENERIC_ERROR };
  }

  const input: Record<string, unknown> = {
    organizationId: readText(formData, "organizationId"),
    title: readText(formData, "title"),
    description: readText(formData, "description"),
  };

  for (const key of ["categoryId", "professionId", "locationId"] as const) {
    const value = readText(formData, key);
    if (value) input[key] = value;
  }
  for (const key of ["employmentType", "salaryPeriod"] as const) {
    const value = readText(formData, key);
    if (value) input[key] = value;
  }
  for (const key of [
    "responsibilities",
    "requirements",
    "educationRequirements",
    "benefits",
    "salaryCurrency",
  ] as const) {
    const value = readText(formData, key);
    if (value) input[key] = value;
  }
  for (const key of ["experienceMin", "experienceMax", "salaryMin", "salaryMax"] as const) {
    const value = readNumber(formData, key);
    if (value !== undefined) input[key] = value;
  }

  const deadline = readText(formData, "deadline");
  if (deadline) {
    const parsedDate = new Date(deadline);
    input.deadline = Number.isNaN(parsedDate.getTime())
      ? deadline
      : parsedDate.toISOString();
  }
  const applicationUrl = readText(formData, "applicationUrl");
  if (applicationUrl) input.applicationUrl = applicationUrl;

  const originalSourceName = readText(formData, "originalSourceName");
  if (originalSourceName) {
    const originalSource: Record<string, string> = {
      sourceName: originalSourceName,
    };
    const originalSourceUrl = readText(formData, "originalSourceUrl");
    if (originalSourceUrl) originalSource.sourceUrl = originalSourceUrl;
    const originalExternalId = readText(formData, "originalExternalId");
    if (originalExternalId) originalSource.externalId = originalExternalId;
    input.originalSource = originalSource;
  }

  const parsed = curatedCreateJobSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  let result: CuratedJobResult;
  try {
    result = await createCuratedJob(actor, parsed.data);
  } catch {
    return { ok: false, error: CREATE_GENERIC_ERROR };
  }
  if (!result.ok) {
    if (result.code === "SLUG_COLLISION") {
      return { ok: false, error: CREATE_SLUG_ERROR };
    }
    return { ok: false, error: CREATE_GENERIC_ERROR };
  }

  if (result.warning) {
    // Creation still succeeded; surface the WARN-only duplicate warning on the
    // create-result UI before navigation (no redirect), so staff can review.
    return { ok: true, itemId: result.item.id, warning: result.warning };
  }

  redirect(`/admin/jobs/${result.item.id}`);
}
