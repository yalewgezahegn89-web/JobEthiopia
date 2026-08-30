"use client";

import { useActionState } from "react";
import {
  updateProfessionAction,
  deleteProfessionAction,
  toggleProfessionActiveAction,
  type TaxonomyActionResult,
} from "../../actions";

const INITIAL_STATE: TaxonomyActionResult = { ok: false };

type ProfessionDetailProps = {
  profession: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    categoryId: string | null;
    categoryName: string | null;
    isActive: boolean;
    jobCount: number;
  };
};

export default function ProfessionDetail({ profession }: ProfessionDetailProps) {
  const [updateState, updateFormAction, updatePending] = useActionState<TaxonomyActionResult, FormData>(
    updateProfessionAction,
    INITIAL_STATE,
  );
  const [deleteState, deleteFormAction, deletePending] = useActionState<TaxonomyActionResult, FormData>(
    deleteProfessionAction,
    INITIAL_STATE,
  );
  const [toggleState, toggleFormAction, togglePending] = useActionState<TaxonomyActionResult, FormData>(
    toggleProfessionActiveAction,
    INITIAL_STATE,
  );

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-lg font-semibold">Actions</h2>

        <form action={toggleFormAction} className="mt-3">
          <input type="hidden" name="professionId" value={profession.id} />
          <button
            type="submit"
            disabled={togglePending}
            className={`rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 ${
              profession.isActive
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {profession.isActive ? "Deactivate" : "Activate"}
          </button>
        </form>
        {toggleState.error && (
          <p role="alert" className="mt-2 text-sm text-red-700">{toggleState.error}</p>
        )}

        <form
          action={deleteFormAction}
          onSubmit={(e) => {
            const msg = profession.jobCount > 0
              ? `Deleting this profession will remove its association from ${profession.jobCount} job${profession.jobCount === 1 ? "" : "s"}. Are you sure you want to permanently delete this profession?`
              : "Are you sure you want to permanently delete this profession? This cannot be undone.";
            if (!confirm(msg)) {
              e.preventDefault();
            }
          }}
          className="mt-3"
        >
          <input type="hidden" name="professionId" value={profession.id} />
          <button
            type="submit"
            disabled={deletePending}
            className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-40"
          >
            Delete profession
          </button>
        </form>
        {deleteState.error && (
          <p role="alert" className="mt-2 text-sm text-red-700">{deleteState.error}</p>
        )}
      </section>

      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-lg font-semibold">Edit profession</h2>
        <form action={updateFormAction} className="mt-3 space-y-3">
          <input type="hidden" name="professionId" value={profession.id} />

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-neutral-700">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={profession.name}
              required
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="slug" className="block text-sm font-medium text-neutral-700">
              Slug
            </label>
            <input
              id="slug"
              name="slug"
              type="text"
              defaultValue={profession.slug}
              required
              pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-mono"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-neutral-700">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              defaultValue={profession.description ?? ""}
              rows={3}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="categoryId" className="block text-sm font-medium text-neutral-700">
              Category ID (optional)
            </label>
            <input
              id="categoryId"
              name="categoryId"
              type="text"
              defaultValue={profession.categoryId ?? ""}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-mono"
              placeholder="UUID or leave empty"
            />
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
