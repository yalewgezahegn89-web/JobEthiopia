"use client";

import { useActionState } from "react";
import {
  approveEmployerOnboardingAction,
  rejectEmployerOnboardingAction,
} from "../actions";
import type { EmployerRequestActionResult } from "../actions";

type ReviewPanelProps = {
  requestId: string;
  status: string;
  canApprove: boolean;
};

const INITIAL_STATE: EmployerRequestActionResult = { ok: false };

export default function ReviewPanel({
  requestId,
  status,
  canApprove,
}: ReviewPanelProps) {
  const [approveState, approveFormAction] = useActionState(
    approveEmployerOnboardingAction,
    INITIAL_STATE,
  );
  const [rejectState, rejectFormAction] = useActionState(
    rejectEmployerOnboardingAction,
    INITIAL_STATE,
  );

  if (status !== "PENDING") {
    return null;
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">Review request</h2>

      {approveState.ok && (
        <p className="text-sm text-success">
          Request approved and employer account activated.
        </p>
      )}
      {approveState.error && (
        <p className="text-sm text-destructive">{approveState.error}</p>
      )}
      {rejectState.error && (
        <p className="text-sm text-destructive">{rejectState.error}</p>
      )}

      {canApprove && (
        <form action={approveFormAction} className="space-y-2">
          <input type="hidden" name="requestId" value={requestId} />
          <p className="text-sm text-muted">
            Approving activates this employer: it creates the organization,
            adds the submitter as an administrator, and promotes their account.
          </p>
          <button
            type="submit"
            className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Approve request
          </button>
        </form>
      )}

      <form action={rejectFormAction} className="space-y-2">
        <input type="hidden" name="requestId" value={requestId} />
        <label className="block text-sm font-medium text-foreground">
          Rejection reason (optional)
        </label>
        <textarea
          name="reviewNotes"
          rows={3}
          maxLength={2000}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          placeholder="Reason for rejection..."
        />
        <button
          type="submit"
          className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Reject request
        </button>
      </form>
    </div>
  );
}
