"use server";

/**
 * Admin job moderation server actions (Batch 51).
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
import { requireStaffAdmin } from "@/lib/auth/context";
import { assertTrustedCsrfFromRequest, CsrfError } from "@/lib/auth/csrf";
import { moderateJob, type ModerationAction } from "@/lib/admin/jobs";
import { dispatchInstantAlertsForJob } from "@/lib/jobAlerts/delivery";
import {
  createCuratedJob,
  type CuratedJobDuplicateWarning,
  type CuratedJobResult,
} from "@/lib/admin/curatedJobs";
import { curatedCreateJobSchema } from "@/lib/validations/curatedJob";

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

  return { ok: true };
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
