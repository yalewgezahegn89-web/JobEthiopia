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
      <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Actions</h2>

        <form action={toggleFormAction} className="mt-4">
          <input type="hidden" name="categoryId" value={category.id} />
          <button
            type="submit"
            disabled={togglePending}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 ${
              category.isActive
                ? "bg-warning hover:opacity-90"
                : "bg-success hover:opacity-90"
            }`}
          >
            {category.isActive ? "Deactivate" : "Activate"}
          </button>
        </form>
        {toggleState.error && (
          <p role="alert" className="mt-2 text-sm text-destructive">{toggleState.error}</p>
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
          className="mt-4"
        >
          <input type="hidden" name="categoryId" value={category.id} />
          <button
            type="submit"
            disabled={deletePending}
            className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
          >
            Delete category
          </button>
        </form>
        {deleteState.error && (
          <p role="alert" className="mt-2 text-sm text-destructive">{deleteState.error}</p>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Edit category</h2>
        <form action={updateFormAction} className="mt-4 space-y-4">
          <input type="hidden" name="categoryId" value={category.id} />

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-foreground">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={category.name}
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
              defaultValue={category.slug}
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
              defaultValue={category.description ?? ""}
              rows={3}
              className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
          </div>

          <div>
            <label htmlFor="parentId" className="block text-sm font-medium text-foreground">
              Parent category ID (optional)
            </label>
            <input
              id="parentId"
              name="parentId"
              type="text"
              defaultValue={category.parentId ?? ""}
              className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground font-mono focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              placeholder="UUID or leave empty for root"
            />
          </div>

          <div>
            <label htmlFor="sortOrder" className="block text-sm font-medium text-foreground">
              Sort order
            </label>
            <input
              id="sortOrder"
              name="sortOrder"
              type="number"
              defaultValue={category.sortOrder}
              className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
