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
    <div className="space-y-4 rounded-md border border-neutral-200 p-4">
      <h2 className="text-lg font-semibold">Review request</h2>

      {approveState.ok && (
        <p className="text-sm text-green-700">
          Request approved and employer account activated.
        </p>
      )}
      {approveState.error && (
        <p className="text-sm text-red-600">{approveState.error}</p>
      )}
      {rejectState.error && (
        <p className="text-sm text-red-600">{rejectState.error}</p>
      )}

      {canApprove && (
        <form action={approveFormAction} className="space-y-2">
          <input type="hidden" name="requestId" value={requestId} />
          <p className="text-sm text-neutral-600">
            Approving activates this employer: it creates the organization,
            adds the submitter as an administrator, and promotes their account.
          </p>
          <button
            type="submit"
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
          >
            Approve request
          </button>
        </form>
      )}

      <form action={rejectFormAction} className="space-y-2">
        <input type="hidden" name="requestId" value={requestId} />
        <label className="block text-sm font-medium text-neutral-700">
          Rejection reason (optional)
        </label>
        <textarea
          name="reviewNotes"
          rows={3}
          maxLength={2000}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          placeholder="Reason for rejection..."
        />
        <button
          type="submit"
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          Reject request
        </button>
      </form>
    </div>
  );
}
