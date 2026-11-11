/**
 * Manual, administrator-triggered publishing of an existing JobEthiopia job
 * to the JobEthiopia-owned Facebook Page.
 *
 * This is the only write path to Facebook. There is no background worker, no
 * cron trigger, and no ingestion hook: every publication starts from an
 * authenticated ADMIN/SUPER_ADMIN request in the admin UI.
 *
 * Safety gates (all required, checked before any Meta request is made):
 * - ENABLE_FACEBOOK_PUBLISHING is exactly "true" (a dedicated flag, fully
 *   independent of ENABLE_FACEBOOK_INGESTION),
 * - the actor is an authenticated ADMIN or SUPER_ADMIN (role comes from the
 *   verified session, never from client input),
 * - FACEBOOK_PAGE_ACCESS_TOKEN is configured,
 * - the job is already PUBLISHED and VERIFIED on the website,
 * - the deadline is not in the past,
 * - applicant eligibility is explicitly confirmed,
 * - the public job URL (the link posted to Facebook) is the canonical
 *   https://jobethiopia.et/jobs/<job-id> URL,
 * - the administrator explicitly confirmed JobEthiopia's right to
 *   redistribute the listing,
 * - the job has provenance, and for Facebook-origin jobs every external Page
 *   source carries both Meta approval and documented content-use
 *   authorization.
 *
 * Duplicate protection is durable: a `facebook_publications` row is claimed
 * (PENDING) inside a unique (job_id, page_id) index before the Graph API
 * call, so a second concurrent request for the same job can never send a
 * second POST. Ambiguous network outcomes are recorded as UNKNOWN and are
 * never retried automatically, because a repeat POST could create a
 * duplicate post on the Page. Every attempt is audited without credentials.
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema/jobs";
import { organizations } from "@/db/schema/organizations";
import { locations } from "@/db/schema/locations";
import { jobSources } from "@/db/schema/jobSources";
import { sources } from "@/db/schema/sources";
import { facebookPublications } from "@/db/schema/facebookPublications";
import { writeAuditLog } from "@/lib/auth/audit";
import type { AuthUser } from "@/lib/auth/roles";
import {
  buildPublicJobUrl,
  isPublicJobUrl,
} from "@/lib/jobs/publicJobUrl";
import {
  applicantEligibilityLabel,
  isDeadlineExpired,
  type ApplicantEligibility,
} from "@/lib/jobs/applicantEligibility";
import { formatEmploymentType } from "@/lib/jobs/employmentTypes";
import {
  OWNED_FACEBOOK_PAGE_ID,
  OWNED_FACEBOOK_PAGE_NAME,
  getOwnedPageAccessToken,
  isFacebookPublishingEnabled,
  isFacebookPublishingLiveEnabled,
  redactFacebookSecrets,
} from "./config";
import { createPageFeedPost } from "./graphClient";

export { OWNED_FACEBOOK_PAGE_ID, OWNED_FACEBOOK_PAGE_NAME };

export type FacebookPublishReason =
  | "PUBLISHED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "FACEBOOK_PUBLISHING_DISABLED"
  | "LIVE_PUBLISHING_DISABLED"
  | "NOT_CONFIGURED"
  | "JOB_NOT_PUBLISHED_VERIFIED"
  | "DEADLINE_EXPIRED"
  | "ELIGIBILITY_NOT_CONFIRMED"
  | "UNSAFE_URL"
  | "CONTENT_AUTHORIZATION_REQUIRED"
  | "NO_PROVENANCE"
  | "FACEBOOK_APPROVAL_REQUIRED"
  | "FACEBOOK_CONTENT_USE_NOT_AUTHORIZED"
  | "DUPLICATE_IN_PROGRESS"
  | "DUPLICATE_ALREADY_PUBLISHED"
  | "DUPLICATE_UNKNOWN_OUTCOME"
  | "GRAPH_REJECTED"
  | "UNKNOWN_OUTCOME";

export interface FacebookPublishResult {
  published: boolean;
  reason: FacebookPublishReason;
  postId?: string;
  /** Sanitized, credential-free error detail (never the access token). */
  error?: string;
}

/** Only explicitly confirmed eligibility values may be advertised. */
const PUBLISHABLE_ELIGIBILITY = new Set<ApplicantEligibility>([
  "ETHIOPIAN_APPLICANTS_CONFIRMED",
  "INTERNATIONAL_APPLICANTS_ACCEPTED",
]);

const JOB_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* -------------------------------------------------------------------------- */
/*  Post composition (original, concise, structured fields only)             */
/* -------------------------------------------------------------------------- */

export interface FacebookPostFields {
  id: string;
  title: string;
  organizationName: string | null;
  locationName: string | null;
  employmentType: string | null;
  deadline: Date | null;
  applicantEligibility: ApplicantEligibility;
}

/**
 * Canonical public URL of the job page on JobEthiopia. This is the `link`
 * attached to the Facebook post; it never points at third-party content.
 */
export function facebookJobPublicUrl(jobId: string): string {
  return buildPublicJobUrl(jobId);
}

function formatDeadline(deadline: Date | null): string | null {
  if (!deadline) return null;
  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeZone: "Africa/Addis_Ababa",
    }).format(deadline);
  } catch {
    return deadline.toISOString().slice(0, 10);
  }
}

/**
 * Builds the exact post text from structured job fields only.
 *
 * The text is an original JobEthiopia composition: title, employer, location,
 * employment type, deadline, eligibility and the canonical job URL. It never
 * copies a third-party Page's post text, full description, or other
 * copyrighted wording.
 */
export function buildFacebookPostMessage(job: FacebookPostFields): string {
  const lines: string[] = [job.title];
  lines.push(job.organizationName ?? "JobEthiopia");

  const details: string[] = [];
  if (job.locationName) details.push(`Location: ${job.locationName}`);
  if (job.employmentType) {
    details.push(`Type: ${formatEmploymentType(job.employmentType)}`);
  }
  const deadline = formatDeadline(job.deadline);
  if (deadline) details.push(`Deadline: ${deadline}`);
  details.push(
    `Eligibility: ${applicantEligibilityLabel(job.applicantEligibility, "en")}`,
  );
  lines.push(details.join(" | "));

  lines.push(`View job and apply: ${facebookJobPublicUrl(job.id)}`);

  return lines.join("\n");
}

/* -------------------------------------------------------------------------- */
/*  Preview loading for the admin UI                                          */
/* -------------------------------------------------------------------------- */

export interface FacebookPublishPreview {
  message: string;
  link: string;
  status: string;
  verificationStatus: string;
  deadlineExpired: boolean;
  eligibilityConfirmed: boolean;
  organizationName: string | null;
  locationName: string | null;
}

/**
 * Loads the structured fields needed to preview the exact post text in the
 * admin UI. Returns null when the job does not exist.
 */
export async function getFacebookPublishPreview(
  jobId: string,
): Promise<FacebookPublishPreview | null> {
  const job = await db.query.jobs.findFirst({
    where: eq(jobs.id, jobId),
    columns: {
      id: true,
      title: true,
      status: true,
      verificationStatus: true,
      deadline: true,
      applicantEligibility: true,
      employmentType: true,
      organizationId: true,
      locationId: true,
    },
  });
  if (!job) return null;

  let organizationName: string | null = null;
  if (job.organizationId) {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, job.organizationId),
      columns: { name: true },
    });
    organizationName = org?.name ?? null;
  }

  let locationName: string | null = null;
  if (job.locationId) {
    const loc = await db.query.locations.findFirst({
      where: eq(locations.id, job.locationId),
      columns: { name: true },
    });
    locationName = loc?.name ?? null;
  }

  const link = facebookJobPublicUrl(job.id);

  return {
    message: buildFacebookPostMessage({
      id: job.id,
      title: job.title,
      organizationName,
      locationName,
      employmentType: job.employmentType,
      deadline: job.deadline,
      applicantEligibility: job.applicantEligibility,
    }),
    link,
    status: job.status,
    verificationStatus: job.verificationStatus,
    deadlineExpired: isDeadlineExpired(job.deadline),
    eligibilityConfirmed: PUBLISHABLE_ELIGIBILITY.has(job.applicantEligibility),
    organizationName,
    locationName,
  };
}

/** Loads the existing publication record for the job on the owned Page. */
export async function getFacebookPublicationForJob(jobId: string) {
  return db.query.facebookPublications.findFirst({
    where: and(
      eq(facebookPublications.jobId, jobId),
      eq(facebookPublications.pageId, OWNED_FACEBOOK_PAGE_ID),
    ),
  });
}

/* -------------------------------------------------------------------------- */
/*  Facebook provenance authorization                                         */
/* -------------------------------------------------------------------------- */

interface FacebookSourceAuthorization {
  sourceId: string;
  facebookPageKind: string | null;
  facebookApprovalState: string | null;
  facebookContentUseState: string | null;
}

/**
 * Loads every Facebook source linked to the job and verifies, for each, the
 * Meta approval and documented content-use authorization required to
 * redistribute content that originated on an external Facebook Page. The
 * JobEthiopia-owned Page is our own content and is always authorized.
 *
 * Fails closed: a missing source record, an external Page without APPROVED
 * status, or one without AUTHORIZED content use blocks publication.
 */
async function checkFacebookProvenance(
  jobId: string,
): Promise<{ ok: true } | { ok: false; reason: FacebookPublishReason }> {
  const jobSourceRows = await db.query.jobSources.findMany({
    where: eq(jobSources.jobId, jobId),
    columns: { sourceId: true },
  });

  if (jobSourceRows.length === 0) {
    return { ok: false, reason: "NO_PROVENANCE" };
  }

  const sourceIds = Array.from(
    new Set(jobSourceRows.map((row) => row.sourceId)),
  );
  const sourceRows = await db.query.sources.findMany({
    where: inArray(sources.id, sourceIds),
    columns: {
      id: true,
      sourceType: true,
      facebookPageKind: true,
      facebookApprovalState: true,
      facebookContentUseState: true,
    },
  });

  const facebookSources: FacebookSourceAuthorization[] = sourceRows
    .filter((row) => row.sourceType === "FACEBOOK")
    .map((row) => ({
      sourceId: row.id,
      facebookPageKind: row.facebookPageKind,
      facebookApprovalState: row.facebookApprovalState,
      facebookContentUseState: row.facebookContentUseState,
    }));

  for (const source of facebookSources) {
    const isExternal = (source.facebookPageKind ?? "EXTERNAL_PAGE") === "EXTERNAL_PAGE";
    if (!isExternal) continue;
    if (source.facebookApprovalState !== "APPROVED") {
      return { ok: false, reason: "FACEBOOK_APPROVAL_REQUIRED" };
    }
    if (source.facebookContentUseState !== "AUTHORIZED") {
      return { ok: false, reason: "FACEBOOK_CONTENT_USE_NOT_AUTHORIZED" };
    }
  }

  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*  Duplicate protection                                                      */
/* -------------------------------------------------------------------------- */

type ClaimOutcome =
  | { ok: true; publicationId: string }
  | { ok: false; reason: FacebookPublishReason };

/**
 * Claims the durable publication record for (job, owned Page) before the
 * Graph API call.
 *
 * - No existing row: a PENDING row is inserted (the unique index makes this
 *   atomic — concurrent inserters race for one row).
 * - Existing PENDING: another attempt is in flight → blocked.
 * - Existing PUBLISHED: the job is already on the Page → blocked.
 * - Existing UNKNOWN: a prior attempt had an ambiguous outcome → blocked
 *   without exception; resolving it requires manual operator review.
 * - Existing FAILED: Facebook definitively rejected the earlier attempt (no
 *   post exists), so one new explicit administrator request may re-claim
 *   the row via a conditional FAILED → PENDING update.
 */
async function claimPublication(
  jobId: string,
  actorId: string,
  now: Date,
): Promise<ClaimOutcome> {
  const inserted = await db
    .insert(facebookPublications)
    .values({
      jobId,
      pageId: OWNED_FACEBOOK_PAGE_ID,
      state: "PENDING",
      requestedBy: actorId,
    })
    .onConflictDoNothing()
    .returning({ id: facebookPublications.id });

  if (inserted.length > 0) {
    return { ok: true, publicationId: inserted[0].id };
  }

  const existing = await getFacebookPublicationForJob(jobId);
  if (!existing) {
    // The conflicting row vanished between the insert and the read. Fail
    // closed: without a record there is no duplicate protection.
    return { ok: false, reason: "DUPLICATE_IN_PROGRESS" };
  }

  switch (existing.state) {
    case "PUBLISHED":
      return { ok: false, reason: "DUPLICATE_ALREADY_PUBLISHED" };
    case "UNKNOWN":
      return { ok: false, reason: "DUPLICATE_UNKNOWN_OUTCOME" };
    case "PENDING":
      return { ok: false, reason: "DUPLICATE_IN_PROGRESS" };
    case "FAILED": {
      const reclaimed = await db
        .update(facebookPublications)
        .set({
          state: "PENDING",
          requestedBy: actorId,
          lastError: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(facebookPublications.id, existing.id),
            eq(facebookPublications.state, "FAILED"),
          ),
        )
        .returning({ id: facebookPublications.id });

      if (reclaimed.length === 0) {
        // Another administrator reclaimed the FAILED row first.
        return { ok: false, reason: "DUPLICATE_IN_PROGRESS" };
      }
      return { ok: true, publicationId: reclaimed[0].id };
    }
    default:
      return { ok: false, reason: "DUPLICATE_IN_PROGRESS" };
  }
}

/* -------------------------------------------------------------------------- */
/*  Main entry point                                                          */
/* -------------------------------------------------------------------------- */

function isSafeHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export interface PublishJobToFacebookInput {
  /**
   * Explicit administrator confirmation that JobEthiopia has the documented
   * right to redistribute this listing to its own Facebook Page. Must come
   * from the confirmation checkbox; a missing confirmation blocks the
   * attempt before any Meta request.
   */
  contentRightsConfirmed: boolean;
}

/**
 * Publishes an existing, already-published and verified job to the
 * JobEthiopia-owned Facebook Page (Page ID 872697352845055). The destination
 * Page is a constant — callers cannot supply a Page ID.
 *
 * The Graph API POST is issued exactly once per claimed record. See the
 * module docstring for the full gate list.
 */
export async function publishJobToOwnedFacebookPage(
  actor: AuthUser,
  jobId: string,
  input: PublishJobToFacebookInput,
): Promise<FacebookPublishResult> {
  // --- Authorization (before configuration or data access) ---
  if (actor.role !== "ADMIN" && actor.role !== "SUPER_ADMIN") {
    await writeAuditLog({
      actorUserId: actor.id,
      action: "JOB_FACEBOOK_PUBLISH_FORBIDDEN",
      targetType: "job",
      targetId: jobId,
      metadata: { pageId: OWNED_FACEBOOK_PAGE_ID, actorRole: actor.role },
    });
    return { published: false, reason: "FORBIDDEN" };
  }

  if (!isFacebookPublishingLiveEnabled()) {
    return { published: false, reason: "LIVE_PUBLISHING_DISABLED" };
  }

  // --- Feature flag (dedicated; never implied by the ingestion flag) ---
  if (!isFacebookPublishingEnabled()) {
    return { published: false, reason: "FACEBOOK_PUBLISHING_DISABLED" };
  }

  // --- Credentials (checked before claiming so a misconfigured token never
  //     burns a publication record) ---
  const token = getOwnedPageAccessToken();
  if (!token.ok) {
    return { published: false, reason: "NOT_CONFIGURED" };
  }

  // --- Target job ---
  if (!JOB_ID_PATTERN.test(jobId)) {
    return { published: false, reason: "NOT_FOUND" };
  }

  const job = await db.query.jobs.findFirst({
    where: eq(jobs.id, jobId),
  });
  if (!job) {
    return { published: false, reason: "NOT_FOUND" };
  }

  if (job.status !== "PUBLISHED" || job.verificationStatus !== "VERIFIED") {
    return { published: false, reason: "JOB_NOT_PUBLISHED_VERIFIED" };
  }

  if (isDeadlineExpired(job.deadline)) {
    return { published: false, reason: "DEADLINE_EXPIRED" };
  }

  if (!PUBLISHABLE_ELIGIBILITY.has(job.applicantEligibility)) {
    return { published: false, reason: "ELIGIBILITY_NOT_CONFIRMED" };
  }

  // --- Explicit redistribution-rights confirmation ---
  if (!input.contentRightsConfirmed) {
    await writeAuditLog({
      actorUserId: actor.id,
      action: "JOB_FACEBOOK_PUBLISH_RIGHTS_UNCONFIRMED",
      targetType: "job",
      targetId: jobId,
      metadata: { pageId: OWNED_FACEBOOK_PAGE_ID },
    });
    return { published: false, reason: "CONTENT_AUTHORIZATION_REQUIRED" };
  }

  // --- URLs ---
  let link: string;
  try {
    link = facebookJobPublicUrl(job.id);
  } catch {
    return { published: false, reason: "UNSAFE_URL" };
  }
  if (!isPublicJobUrl(link)) {
    return { published: false, reason: "UNSAFE_URL" };
  }
  if (job.applicationUrl && !isSafeHttpUrl(job.applicationUrl)) {
    return { published: false, reason: "UNSAFE_URL" };
  }

  // --- Provenance / Facebook-origin authorization ---
  const provenance = await checkFacebookProvenance(job.id);
  if (!provenance.ok) {
    return { published: false, reason: provenance.reason };
  }

  // --- Post text (built server-side from structured fields; the client
  //     never supplies the text) ---
  let organizationName: string | null = null;
  if (job.organizationId) {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, job.organizationId),
      columns: { name: true },
    });
    organizationName = org?.name ?? null;
  }
  let locationName: string | null = null;
  if (job.locationId) {
    const loc = await db.query.locations.findFirst({
      where: eq(locations.id, job.locationId),
      columns: { name: true },
    });
    locationName = loc?.name ?? null;
  }

  const message = buildFacebookPostMessage({
    id: job.id,
    title: job.title,
    organizationName,
    locationName,
    employmentType: job.employmentType,
    deadline: job.deadline,
    applicantEligibility: job.applicantEligibility,
  });

  // --- Durable duplicate protection: claim before calling Meta ---
  const now = new Date();
  const claim = await claimPublication(job.id, actor.id, now);
  if (!claim.ok) {
    await writeAuditLog({
      actorUserId: actor.id,
      action: "JOB_FACEBOOK_PUBLISH_DUPLICATE_REJECTED",
      targetType: "job",
      targetId: jobId,
      metadata: { pageId: OWNED_FACEBOOK_PAGE_ID, reason: claim.reason },
    });
    return { published: false, reason: claim.reason };
  }
  const publicationId = claim.publicationId;

  // --- Single Graph API POST (never retried) ---
  let outcome: Awaited<ReturnType<typeof createPageFeedPost>>;
  try {
    outcome = await createPageFeedPost(
      OWNED_FACEBOOK_PAGE_ID,
      token.accessToken,
      { message, link },
    );
  } catch (err) {
    // An unexpected local error is still an ambiguous outcome: we do not
    // know whether Facebook received the request. Fail closed as UNKNOWN.
    outcome = {
      ok: false,
      error: redactFacebookSecrets(
        err instanceof Error ? err.message : "Graph API publish request failed",
      ),
      ambiguous: true,
    };
  }

  const sanitizedError = outcome.ok
    ? null
    : redactFacebookSecrets(outcome.error || "Graph API publish request failed");

  if (outcome.ok) {
    const publishedAt = new Date();
    await db
      .update(facebookPublications)
      .set({
        state: "PUBLISHED",
        facebookPostId: outcome.postId,
        lastError: null,
        publishedAt,
        updatedAt: publishedAt,
      })
      .where(eq(facebookPublications.id, publicationId));

    await writeAuditLog({
      actorUserId: actor.id,
      action: "JOB_FACEBOOK_PUBLISHED",
      targetType: "job",
      targetId: jobId,
      metadata: {
        publicationId,
        pageId: OWNED_FACEBOOK_PAGE_ID,
        facebookPostId: outcome.postId,
        actorRole: actor.role,
        contentRightsConfirmed: true,
      },
    });

    return {
      published: true,
      reason: "PUBLISHED",
      postId: outcome.postId,
    };
  }

  if (outcome.ambiguous) {
    // The post may exist on Facebook. Record UNKNOWN and never retry
    // automatically; resolving it is a manual operator task.
    await db
      .update(facebookPublications)
      .set({
        state: "UNKNOWN",
        lastError: sanitizedError,
        updatedAt: new Date(),
      })
      .where(eq(facebookPublications.id, publicationId));

    await writeAuditLog({
      actorUserId: actor.id,
      action: "JOB_FACEBOOK_PUBLISH_UNKNOWN",
      targetType: "job",
      targetId: jobId,
      metadata: {
        publicationId,
        pageId: OWNED_FACEBOOK_PAGE_ID,
        error: sanitizedError,
        actorRole: actor.role,
        contentRightsConfirmed: true,
      },
    });

    return {
      published: false,
      reason: "UNKNOWN_OUTCOME",
      error: sanitizedError ?? undefined,
    };
  }

  // Facebook definitively rejected the post; no post was created.
  await db
    .update(facebookPublications)
    .set({
      state: "FAILED",
      lastError: sanitizedError,
      updatedAt: new Date(),
    })
    .where(eq(facebookPublications.id, publicationId));

  await writeAuditLog({
    actorUserId: actor.id,
    action: "JOB_FACEBOOK_PUBLISH_FAILED",
    targetType: "job",
    targetId: jobId,
    metadata: {
      publicationId,
      pageId: OWNED_FACEBOOK_PAGE_ID,
      error: sanitizedError,
      actorRole: actor.role,
      contentRightsConfirmed: true,
    },
  });

  return {
    published: false,
    reason: "GRAPH_REJECTED",
    error: sanitizedError ?? undefined,
  };
}
