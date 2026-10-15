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
    <div className="space-y-4 rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">Verification</h2>

      {verifyState.error && (
        <p className="text-sm text-destructive">{verifyState.error}</p>
      )}
      {rejectState.error && (
        <p className="text-sm text-destructive">{rejectState.error}</p>
      )}
      {reviewState.error && (
        <p className="text-sm text-destructive">{reviewState.error}</p>
      )}

      {!isVerified ? (
        <form action={verifyFormAction} className="space-y-2">
          <input type="hidden" name="orgId" value={orgId} />
          <input type="hidden" name="action" value="VERIFY" />
          <button
            type="submit"
            className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Verify Organization
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <form action={rejectFormAction} className="space-y-2">
            <input type="hidden" name="orgId" value={orgId} />
            <input type="hidden" name="action" value="REJECT" />
            <label className="block text-sm font-medium text-foreground">
              Rejection reason (optional)
            </label>
            <textarea
              name="notes"
              rows={3}
              maxLength={2000}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              placeholder="Reason for rejection..."
            />
            <button
              type="submit"
              className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Reject Verification
            </button>
          </form>

          <form action={reviewFormAction} className="space-y-2">
            <input type="hidden" name="orgId" value={orgId} />
            <input type="hidden" name="action" value="REQUEST_REVIEW" />
            <label className="block text-sm font-medium text-foreground">
              Review notes (optional)
            </label>
            <textarea
              name="notes"
              rows={3}
              maxLength={2000}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              placeholder="What needs review..."
            />
            <button
              type="submit"
              className="rounded-lg bg-warning px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Request Review
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
