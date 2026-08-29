"use client";

import { useActionState } from "react";
import { verifyOrganizationAction } from "../actions";

type VerificationPanelProps = {
  orgId: string;
  isVerified: boolean;
};

const INITIAL_STATE = { ok: false as const };

export default function VerificationPanel({
  orgId,
  isVerified,
}: VerificationPanelProps) {
  const [verifyState, verifyFormAction] = useActionState(
    verifyOrganizationAction,
    INITIAL_STATE,
  );
  const [rejectState, rejectFormAction] = useActionState(
    verifyOrganizationAction,
    INITIAL_STATE,
  );
  const [reviewState, reviewFormAction] = useActionState(
    verifyOrganizationAction,
    INITIAL_STATE,
  );

  return (
    <div className="space-y-4 rounded-md border border-neutral-200 p-4">
      <h2 className="text-lg font-semibold">Verification</h2>

      {verifyState.error && (
        <p className="text-sm text-red-600">{verifyState.error}</p>
      )}
      {rejectState.error && (
        <p className="text-sm text-red-600">{rejectState.error}</p>
      )}
      {reviewState.error && (
        <p className="text-sm text-red-600">{reviewState.error}</p>
      )}

      {!isVerified ? (
        <form action={verifyFormAction} className="space-y-2">
          <input type="hidden" name="orgId" value={orgId} />
          <input type="hidden" name="action" value="VERIFY" />
          <button
            type="submit"
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
          >
            Verify Organization
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <form action={rejectFormAction} className="space-y-2">
            <input type="hidden" name="orgId" value={orgId} />
            <input type="hidden" name="action" value="REJECT" />
            <label className="block text-sm font-medium text-neutral-700">
              Rejection reason (optional)
            </label>
            <textarea
              name="notes"
              rows={3}
              maxLength={2000}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              placeholder="Reason for rejection..."
            />
            <button
              type="submit"
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Reject Verification
            </button>
          </form>

          <form action={reviewFormAction} className="space-y-2">
            <input type="hidden" name="orgId" value={orgId} />
            <input type="hidden" name="action" value="REQUEST_REVIEW" />
            <label className="block text-sm font-medium text-neutral-700">
              Review notes (optional)
            </label>
            <textarea
              name="notes"
              rows={3}
              maxLength={2000}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              placeholder="What needs review..."
            />
            <button
              type="submit"
              className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
            >
              Request Review
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
