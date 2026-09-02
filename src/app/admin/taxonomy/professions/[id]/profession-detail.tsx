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
      <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Actions</h2>

        <form action={toggleFormAction} className="mt-4">
          <input type="hidden" name="professionId" value={profession.id} />
          <button
            type="submit"
            disabled={togglePending}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 ${
              profession.isActive
                ? "bg-warning hover:opacity-90"
                : "bg-success hover:opacity-90"
            }`}
          >
            {profession.isActive ? "Deactivate" : "Activate"}
          </button>
        </form>
        {toggleState.error && (
          <p role="alert" className="mt-2 text-sm text-destructive">{toggleState.error}</p>
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
          className="mt-4"
        >
          <input type="hidden" name="professionId" value={profession.id} />
          <button
            type="submit"
            disabled={deletePending}
            className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
          >
            Delete profession
          </button>
        </form>
        {deleteState.error && (
          <p role="alert" className="mt-2 text-sm text-destructive">{deleteState.error}</p>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Edit profession</h2>
        <form action={updateFormAction} className="mt-4 space-y-4">
          <input type="hidden" name="professionId" value={profession.id} />

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-foreground">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={profession.name}
              required
              className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
          </div>

          <div>
            <label htmlFor="slug" className="block text-sm font-medium text-foreground">
              Slug
            </label>
            <input
              id="slug"
              name="slug"
              type="text"
              defaultValue={profession.slug}
              required
              pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground font-mono focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-foreground">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              defaultValue={profession.description ?? ""}
              rows={3}
              className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
          </div>

          <div>
            <label htmlFor="categoryId" className="block text-sm font-medium text-foreground">
              Category ID (optional)
            </label>
            <input
              id="categoryId"
              name="categoryId"
              type="text"
              defaultValue={profession.categoryId ?? ""}
              className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground font-mono focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              placeholder="UUID or leave empty"
            />
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
