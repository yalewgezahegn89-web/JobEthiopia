"use client";

import { useActionState } from "react";
import {
  updateSourceAction,
  deleteSourceAction,
  toggleSourceActiveAction,
  type SourceActionResult,
} from "../actions";
import {
  syncSourceAction,
  type SourceSyncResult,
} from "../sync-action";

const INITIAL_STATE: SourceActionResult = { ok: false };
const INITIAL_SYNC_STATE: SourceSyncResult = { ok: false };

type SourceDetailProps = {
  source: {
    id: string;
    name: string;
    sourceType: string;
    baseUrl: string | null;
    isActive: boolean;
    trustLevel: string;
    autoPublish: boolean;
    checkFrequencyMinutes: number | null;
    facebookPageId: string | null;
    facebookPageKind: string | null;
    facebookApprovalState: string | null;
    facebookContentUseState: string | null;
    facebookAuthorizationNote: string | null;
  };
};

export default function SourceDetail({ source }: SourceDetailProps) {
  const [updateState, updateFormAction, updatePending] = useActionState<SourceActionResult, FormData>(
    updateSourceAction,
    INITIAL_STATE,
  );
  const [deleteState, deleteFormAction, deletePending] = useActionState<SourceActionResult, FormData>(
    deleteSourceAction,
    INITIAL_STATE,
  );
  const [toggleState, toggleFormAction, togglePending] = useActionState<SourceActionResult, FormData>(
    toggleSourceActiveAction,
    INITIAL_STATE,
  );
  const [syncState, syncFormAction, syncPending] = useActionState<SourceSyncResult, FormData>(
    syncSourceAction,
    INITIAL_SYNC_STATE,
  );

  return (
    <div className="space-y-4">
      <section className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Actions</h2>

        <form action={toggleFormAction} className="mt-4">
          <input type="hidden" name="sourceId" value={source.id} />
          <button
            type="submit"
            disabled={togglePending}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 ${
              source.isActive
                ? "bg-warning hover:opacity-90"
                : "bg-success hover:opacity-90"
            }`}
          >
            {source.isActive ? "Deactivate" : "Activate"}
          </button>
        </form>
        {toggleState.error && (
          <p role="alert" className="mt-2 text-sm text-destructive">{toggleState.error}</p>
        )}

        <form
          action={deleteFormAction}
          onSubmit={(e) => {
            if (!confirm("Are you sure you want to permanently delete this source? This cannot be undone.")) {
              e.preventDefault();
            }
          }}
          className="mt-4"
        >
          <input type="hidden" name="sourceId" value={source.id} />
          <button
            type="submit"
            disabled={deletePending}
            className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
          >
            Delete source
          </button>
        </form>
        {deleteState.error && (
          <p role="alert" className="mt-2 text-sm text-destructive">{deleteState.error}</p>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Manual sync</h2>
        <p className="mt-1 text-sm text-muted">
          Runs this source now. Status, last check, and last error update on
          this page.
        </p>
        <form action={syncFormAction} className="mt-4">
          <input type="hidden" name="sourceId" value={source.id} />
          <button
            type="submit"
            disabled={syncPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
          >
            {syncPending ? "Syncing..." : "Sync now"}
          </button>
        </form>
        {syncState.message && (
          <p className="mt-2 text-sm text-success">{syncState.message}</p>
        )}
        {syncState.error && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {syncState.error}
          </p>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Edit source</h2>
        <form action={updateFormAction} className="mt-4 space-y-4">
          <input type="hidden" name="sourceId" value={source.id} />

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-foreground">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={source.name}
              required
              className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
          </div>

          <div>
            <label htmlFor="sourceType" className="block text-sm font-medium text-foreground">
              Source type
            </label>
            <select
              id="sourceType"
              name="sourceType"
              defaultValue={source.sourceType}
              required
              className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <option value="MANUAL">MANUAL</option>
              <option value="WEBSITE">WEBSITE</option>
              <option value="API">API</option>
              <option value="FEED">FEED</option>
              <option value="EMPLOYER">EMPLOYER</option>
              <option value="OTHER">OTHER</option>
              <option value="FACEBOOK">FACEBOOK</option>
            </select>
          </div>

          <div>
            <label htmlFor="baseUrl" className="block text-sm font-medium text-foreground">
              Base URL
            </label>
            <input
              id="baseUrl"
              name="baseUrl"
              type="url"
              defaultValue={source.baseUrl ?? ""}
              className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              placeholder="https://example.com"
            />
          </div>

          <fieldset className="rounded-lg border border-border bg-surface-raised p-4">
            <legend className="px-1 text-sm font-medium text-foreground">
              Facebook Page (only for FACEBOOK sources)
            </legend>
            <p className="mt-1 text-xs text-muted">
              Tokens are never stored here. External Pages stay blocked unless
              approval is APPROVED and content use is AUTHORIZED.
            </p>
            <div className="mt-3 space-y-3">
              <div>
                <label htmlFor="facebookPageId" className="block text-sm font-medium text-foreground">
                  Facebook Page ID
                </label>
                <input
                  id="facebookPageId"
                  name="facebookPageId"
                  type="text"
                  defaultValue={source.facebookPageId ?? ""}
                  className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                />
              </div>
              <div>
                <label htmlFor="facebookPageKind" className="block text-sm font-medium text-foreground">
                  Page kind
                </label>
                <select
                  id="facebookPageKind"
                  name="facebookPageKind"
                  defaultValue={source.facebookPageKind ?? ""}
                  className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <option value="">Not a Facebook source</option>
                  <option value="OWNED_PAGE">OWNED_PAGE</option>
                  <option value="EXTERNAL_PAGE">EXTERNAL_PAGE</option>
                </select>
              </div>
              <div>
                <label htmlFor="facebookApprovalState" className="block text-sm font-medium text-foreground">
                  Meta Page Public Content Access
                </label>
                <select
                  id="facebookApprovalState"
                  name="facebookApprovalState"
                  defaultValue={source.facebookApprovalState ?? "NOT_REQUESTED"}
                  className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <option value="NOT_REQUESTED">NOT_REQUESTED</option>
                  <option value="PENDING">PENDING</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="REJECTED">REJECTED</option>
                </select>
              </div>
              <div>
                <label htmlFor="facebookContentUseState" className="block text-sm font-medium text-foreground">
                  Content-use authorization
                </label>
                <select
                  id="facebookContentUseState"
                  name="facebookContentUseState"
                  defaultValue={
                    source.facebookContentUseState ?? "NOT_RECORDED"
                  }
                  className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <option value="NOT_RECORDED">NOT_RECORDED</option>
                  <option value="PENDING">PENDING</option>
                  <option value="AUTHORIZED">AUTHORIZED</option>
                  <option value="DENIED">DENIED</option>
                </select>
              </div>
              <div>
                <label htmlFor="facebookAuthorizationNote" className="block text-sm font-medium text-foreground">
                  Authorization note
                </label>
                <textarea
                  id="facebookAuthorizationNote"
                  name="facebookAuthorizationNote"
                  rows={2}
                  defaultValue={source.facebookAuthorizationNote ?? ""}
                  className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                />
              </div>
            </div>
          </fieldset>

          <div>
            <label htmlFor="trustLevel" className="block text-sm font-medium text-foreground">
              Trust level
            </label>
            <select
              id="trustLevel"
              name="trustLevel"
              defaultValue={source.trustLevel}
              required
              className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>

          <div>
            <label htmlFor="checkFrequencyMinutes" className="block text-sm font-medium text-foreground">
              Check frequency (minutes)
            </label>
            <input
              id="checkFrequencyMinutes"
              name="checkFrequencyMinutes"
              type="number"
              min={5}
              max={10080}
              defaultValue={source.checkFrequencyMinutes ?? ""}
              className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              placeholder="e.g. 1440"
            />
            <p className="mt-1 text-xs text-muted">
              Optional. 5 to 10080 minutes; leave blank to clear.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-surface-raised p-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                name="autoPublish"
                value="true"
                defaultChecked={source.autoPublish}
                className="mt-0.5 h-4 w-4 rounded border-border text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
              <span>
                <span className="block text-sm font-medium text-foreground">
                  Auto-publish qualifying imports
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  Explicit opt-in. Requires HIGH trust, an approved source type,
                  confirmed applicant eligibility, a future deadline and full
                  publication validation.
                </span>
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={updatePending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
          >
            Save changes
          </button>
        </form>
        {updateState.error && (
          <p role="alert" className="mt-2 text-sm text-destructive">{updateState.error}</p>
        )}
      </section>
    </div>
  );
}
