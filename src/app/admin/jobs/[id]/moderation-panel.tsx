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

  return (
    <section className="rounded-lg border border-neutral-200 p-4">
      <h2 className="text-lg font-semibold">Moderation actions</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Current status: <strong>{status}</strong> · Verification:{" "}
        <strong>{verificationStatus}</strong>
      </p>

      <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
        <input type="hidden" name="jobId" value={jobId} />
        <input type="hidden" name="action" value="PUBLISH" />
        <button
          type="submit"
          disabled={isPending || !canPublish}
          className="rounded-md bg-green-700 px-3 py-1.5 text-sm text-white disabled:opacity-40"
        >
          Publish
        </button>
      </form>

      <form action={formAction} className="mt-2 flex flex-wrap items-center gap-2">
        <input type="hidden" name="jobId" value={jobId} />
        <input type="hidden" name="action" value="REJECT" />
        <button
          type="submit"
          disabled={isPending || !canReject}
          className="rounded-md bg-red-700 px-3 py-1.5 text-sm text-white disabled:opacity-40"
        >
          Reject
        </button>
      </form>

      <form action={formAction} className="mt-2 flex flex-wrap items-center gap-2">
        <input type="hidden" name="jobId" value={jobId} />
        <input type="hidden" name="action" value="MARK_INVALID" />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
        >
          Mark invalid
        </button>
      </form>

      <form action={formAction} className="mt-2 flex flex-wrap items-center gap-2">
        <input type="hidden" name="jobId" value={jobId} />
        <input type="hidden" name="action" value="REQUEST_REVIEW" />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
        >
          Request review
        </button>
      </form>

      {!state.ok && state.error ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
    </section>
  );
}
