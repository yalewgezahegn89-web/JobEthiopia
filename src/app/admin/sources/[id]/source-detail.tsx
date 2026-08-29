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
      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-lg font-semibold">Actions</h2>

        <form action={toggleFormAction} className="mt-3">
          <input type="hidden" name="sourceId" value={source.id} />
          <button
            type="submit"
            disabled={togglePending}
            className={`rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 ${
              source.isActive
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {source.isActive ? "Deactivate" : "Activate"}
          </button>
        </form>
        {toggleState.error && (
          <p role="alert" className="mt-2 text-sm text-red-700">{toggleState.error}</p>
        )}

        <form
          action={deleteFormAction}
          onSubmit={(e) => {
            if (!confirm("Are you sure you want to permanently delete this source? This cannot be undone.")) {
              e.preventDefault();
            }
          }}
          className="mt-3"
        >
          <input type="hidden" name="sourceId" value={source.id} />
          <button
            type="submit"
            disabled={deletePending}
            className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-40"
          >
            Delete source
          </button>
        </form>
        {deleteState.error && (
          <p role="alert" className="mt-2 text-sm text-red-700">{deleteState.error}</p>
        )}
      </section>

      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-lg font-semibold">Edit source</h2>
        <form action={updateFormAction} className="mt-3 space-y-3">
          <input type="hidden" name="sourceId" value={source.id} />

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-neutral-700">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={source.name}
              required
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="sourceType" className="block text-sm font-medium text-neutral-700">
              Source type
            </label>
            <select
              id="sourceType"
              name="sourceType"
              defaultValue={source.sourceType}
              required
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
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
            <label htmlFor="baseUrl" className="block text-sm font-medium text-neutral-700">
              Base URL
            </label>
            <input
              id="baseUrl"
              name="baseUrl"
              type="url"
              defaultValue={source.baseUrl ?? ""}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              placeholder="https://example.com"
            />
          </div>

          <div>
            <label htmlFor="trustLevel" className="block text-sm font-medium text-neutral-700">
              Trust level
            </label>
            <select
              id="trustLevel"
              name="trustLevel"
              defaultValue={source.trustLevel}
              required
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={updatePending}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-40"
          >
            Save changes
          </button>
        </form>
        {updateState.error && (
          <p role="alert" className="mt-2 text-sm text-red-700">{updateState.error}</p>
        )}
      </section>
    </div>
  );
}
