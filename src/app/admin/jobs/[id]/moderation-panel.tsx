"use client";

import { useActionState } from "react";
import {
  moderateJobAction,
  type ModerationActionResult,
} from "../actions";

const initialState: ModerationActionResult = { ok: true };

export default function ModerationPanel({
  jobId,
  status,
  verificationStatus,
}: {
  jobId: string;
  status: string;
  verificationStatus: string;
}) {
  const [state, formAction, isPending] = useActionState<ModerationActionResult, FormData>(
    moderateJobAction,
    initialState,
  );

  const canPublish =
    status !== "REMOVED" && !["PUBLISHED"].includes(status);
  const canReject = status !== "REMOVED";

  const focusRing =
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">Moderation actions</h2>
      <p className="mt-1 text-sm text-muted">
        Current status: <strong>{status}</strong> · Verification:{" "}
        <strong>{verificationStatus}</strong>
      </p>

      <form action={formAction} className="mt-4">
        <input type="hidden" name="jobId" value={jobId} />
        <input type="hidden" name="action" value="PUBLISH" />
        <button
          type="submit"
          disabled={isPending || !canPublish}
          className={`rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
        >
          Publish
        </button>
      </form>

      <form action={formAction} className="mt-2">
        <input type="hidden" name="jobId" value={jobId} />
        <input type="hidden" name="action" value="REJECT" />
        <button
          type="submit"
          disabled={isPending || !canReject}
          className={`rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
        >
          Reject
        </button>
      </form>

      <form action={formAction} className="mt-2">
        <input type="hidden" name="jobId" value={jobId} />
        <input type="hidden" name="action" value="MARK_INVALID" />
        <button
          type="submit"
          disabled={isPending}
          className={`rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
        >
          Mark invalid
        </button>
      </form>

      <form action={formAction} className="mt-2">
        <input type="hidden" name="jobId" value={jobId} />
        <input type="hidden" name="action" value="REQUEST_REVIEW" />
        <button
          type="submit"
          disabled={isPending}
          className={`rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
        >
          Request review
        </button>
      </form>

      {!state.ok && state.error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </section>
  );
}
