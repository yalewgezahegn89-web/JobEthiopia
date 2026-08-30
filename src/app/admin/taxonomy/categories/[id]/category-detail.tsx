"use client";

import { useActionState } from "react";
import {
  updateCategoryAction,
  deleteCategoryAction,
  toggleCategoryActiveAction,
  type TaxonomyActionResult,
} from "../../actions";

const INITIAL_STATE: TaxonomyActionResult = { ok: false };

type CategoryDetailProps = {
  category: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    parentId: string | null;
    sortOrder: number;
    isActive: boolean;
    jobCount: number;
    professionCount: number;
    childCount: number;
  };
};

export default function CategoryDetail({ category }: CategoryDetailProps) {
  const [updateState, updateFormAction, updatePending] = useActionState<TaxonomyActionResult, FormData>(
    updateCategoryAction,
    INITIAL_STATE,
  );
  const [deleteState, deleteFormAction, deletePending] = useActionState<TaxonomyActionResult, FormData>(
    deleteCategoryAction,
    INITIAL_STATE,
  );
  const [toggleState, toggleFormAction, togglePending] = useActionState<TaxonomyActionResult, FormData>(
    toggleCategoryActiveAction,
    INITIAL_STATE,
  );

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-lg font-semibold">Actions</h2>

        <form action={toggleFormAction} className="mt-3">
          <input type="hidden" name="categoryId" value={category.id} />
          <button
            type="submit"
            disabled={togglePending}
            className={`rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 ${
              category.isActive
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {category.isActive ? "Deactivate" : "Activate"}
          </button>
        </form>
        {toggleState.error && (
          <p role="alert" className="mt-2 text-sm text-red-700">{toggleState.error}</p>
        )}

        <form
          action={deleteFormAction}
          onSubmit={(e) => {
            const impact = [];
            if (category.jobCount > 0) impact.push(`${category.jobCount} job${category.jobCount === 1 ? "" : "s"}`);
            if (category.professionCount > 0) impact.push(`${category.professionCount} profession${category.professionCount === 1 ? "" : "s"}`);
            if (category.childCount > 0) impact.push(`${category.childCount} child${category.childCount === 1 ? "" : "ren"}`);
            const msg = impact.length > 0
              ? `Deleting this category will remove its association from ${impact.join(", ")}. Are you sure you want to permanently delete this category?`
              : "Are you sure you want to permanently delete this category? This cannot be undone.";
            if (!confirm(msg)) {
              e.preventDefault();
            }
          }}
          className="mt-3"
        >
          <input type="hidden" name="categoryId" value={category.id} />
          <button
            type="submit"
            disabled={deletePending}
            className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-40"
          >
            Delete category
          </button>
        </form>
        {deleteState.error && (
          <p role="alert" className="mt-2 text-sm text-red-700">{deleteState.error}</p>
        )}
      </section>

      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-lg font-semibold">Edit category</h2>
        <form action={updateFormAction} className="mt-3 space-y-3">
          <input type="hidden" name="categoryId" value={category.id} />

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-neutral-700">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={category.name}
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
              defaultValue={category.slug}
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
              defaultValue={category.description ?? ""}
              rows={3}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="parentId" className="block text-sm font-medium text-neutral-700">
              Parent category ID (optional)
            </label>
            <input
              id="parentId"
              name="parentId"
              type="text"
              defaultValue={category.parentId ?? ""}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-mono"
              placeholder="UUID or leave empty for root"
            />
          </div>

          <div>
            <label htmlFor="sortOrder" className="block text-sm font-medium text-neutral-700">
              Sort order
            </label>
            <input
              id="sortOrder"
              name="sortOrder"
              type="number"
              defaultValue={category.sortOrder}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
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
