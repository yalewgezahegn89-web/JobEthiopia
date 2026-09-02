"use client";

import { useActionState } from "react";
import {
  updateSourceAction,
  deleteSourceAction,
  toggleSourceActiveAction,
  type SourceActionResult,
} from "../actions";

const INITIAL_STATE: SourceActionResult = { ok: false };

type SourceDetailProps = {
  source: {
    id: string;
    name: string;
    sourceType: string;
    baseUrl: string | null;
    isActive: boolean;
    trustLevel: string;
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
