"use client";

import { useActionState, useState } from "react";
import {
  publishJobToFacebookAction,
  type FacebookPublishActionResult,
} from "../actions";

export type FacebookPublicationInfo = {
  state: "PENDING" | "PUBLISHED" | "FAILED" | "UNKNOWN";
  facebookPostId: string | null;
  lastError: string | null;
};

const initialState: FacebookPublishActionResult = { ok: true };

/**
 * Manual "Publish to Facebook" panel for the admin job detail page.
 *
 * Before any request is sent the administrator sees the exact post text and
 * the destination Page, must check the publication-rights confirmation, and
 * must press the explicit Publish button. The button is disabled while the
 * request is in flight and whenever a durable publication record already
 * blocks a repeat (PUBLISHED / PENDING / UNKNOWN). The Page access token is
 * never present in this component — it lives only in the server
 * environment.
 */
export default function FacebookPublishPanel({
  jobId,
  pageName,
  pageId,
  postMessage,
  postLink,
  publication,
  eligible,
  ineligibleReason,
  livePublishingEnabled,
  previewDeployment,
}: {
  jobId: string;
  pageName: string;
  pageId: string;
  postMessage: string;
  postLink: string;
  publication: FacebookPublicationInfo | null;
  eligible: boolean;
  ineligibleReason: string | null;
  livePublishingEnabled: boolean;
  previewDeployment: boolean;
}) {
  const [state, formAction, isPending] = useActionState<
    FacebookPublishActionResult,
    FormData
  >(publishJobToFacebookAction, initialState);
  const [confirmed, setConfirmed] = useState(false);

  const blockedByPublication =
    publication?.state === "PUBLISHED" ||
    publication?.state === "PENDING" ||
    publication?.state === "UNKNOWN";

  const canSubmit =
    livePublishingEnabled &&
    eligible &&
    !blockedByPublication &&
    confirmed &&
    !isPending;

  const focusRing =
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">
        Publish to Facebook
      </h2>
      <p className="mt-1 text-sm text-muted">
        Destination: <strong>{pageName}</strong> (Page ID {pageId}) — the
        JobEthiopia-owned Facebook Page.
      </p>

      {!livePublishingEnabled ? (
        <div className="mt-4" role="alert">
          <p className="text-sm text-warning">
            {previewDeployment
              ? "Live Facebook publishing is disabled in Preview. Use Preview to review the post and validate eligibility only."
              : "Live Facebook publishing is disabled outside Production. Use this view to review the post and validate eligibility only."}
          </p>
          {previewDeployment ? (
            <p className="mt-1 text-xs text-muted">
              This job is stored in the isolated Preview database. Its public
              job URL is not confirmed live.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4">
        <p className="text-sm font-medium text-foreground">
          Exact post text to be published:
        </p>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-surface-raised p-3 text-xs text-foreground">
          {postMessage}
        </pre>
        <p className="mt-2 break-all text-xs text-muted">
          Attached link: {postLink}
        </p>
      </div>

      {publication ? (
        <div className="mt-4 text-sm">
          {publication.state === "PUBLISHED" ? (
            <p className="text-success" role="status">
              Already published to Facebook
              {publication.facebookPostId
                ? ` — post ID ${publication.facebookPostId}`
                : ""}
              . This job cannot be published to the Page again.
            </p>
          ) : null}
          {publication.state === "PENDING" ? (
            <p className="text-warning" role="status">
              A publish attempt for this job is already in progress. Repeat
              requests are blocked to prevent duplicate posts.
            </p>
          ) : null}
          {publication.state === "UNKNOWN" ? (
            <p className="text-warning" role="alert">
              A previous publish attempt had an unclear result. The post may
              already exist on the Page, so publishing is blocked until the
              recorded UNKNOWN outcome is reviewed manually by an operator.
            </p>
          ) : null}
          {publication.state === "FAILED" ? (
            <p className="text-destructive" role="alert">
              Previous attempt failed:{" "}
              {publication.lastError ?? "Facebook rejected the post"}. Facebook
              definitively rejected it, so you may publish again after fixing
              the cause.
            </p>
          ) : null}
        </div>
      ) : null}

      {!eligible && ineligibleReason ? (
        <p className="mt-4 text-sm text-muted" role="alert">
          {ineligibleReason}
        </p>
      ) : null}

      <form action={formAction} className="mt-4">
        <input type="hidden" name="jobId" value={jobId} />
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            name="confirmContentRights"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            disabled={
              !livePublishingEnabled ||
              !eligible ||
              blockedByPublication ||
              isPending
            }
            className={`mt-0.5 ${focusRing}`}
          />
          <span>
            I confirm that JobEthiopia has the documented right to
            redistribute this listing to the JobEthiopia Facebook Page.
          </span>
        </label>

        <button
          type="submit"
          disabled={!canSubmit}
          className={`mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
        >
          {isPending ? "Publishing..." : "Publish to Facebook"}
        </button>
      </form>

      {state.ok && state.postId ? (
        <p className="mt-3 text-sm text-success" role="status">
          Published to Facebook — post ID {state.postId}.
        </p>
      ) : null}

      {!state.ok && state.error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
    </section>
  );
}
