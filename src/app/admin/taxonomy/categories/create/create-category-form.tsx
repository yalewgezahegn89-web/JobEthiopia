"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createCategoryAction, type TaxonomyActionResult } from "../../actions";

const INITIAL_STATE: TaxonomyActionResult = { ok: false };

export default function CreateCategoryForm() {
  const [state, formAction, pending] = useActionState<TaxonomyActionResult, FormData>(
    createCategoryAction,
    INITIAL_STATE,
  );

  if (state.ok && state.redirect) {
    return (
      <section className="mt-6 rounded-xl border border-border bg-success-light p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-success">Category created</h2>
        <p className="mt-2 text-sm text-muted">
          The category was created successfully.
        </p>
        <Link
          href="/admin/taxonomy/categories"
          className="mt-3 inline-block text-sm font-medium text-success hover:text-primary"
        >
          &larr; Back to categories
        </Link>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">New category</h2>
      <form action={formAction} className="mt-4 space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-foreground">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
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
            required
            pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
            className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground font-mono focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            placeholder="e.g. engineering"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-foreground">
            Description
          </label>
          <textarea
            id="description"
            name="description"
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
            defaultValue={0}
            className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
        >
          Create category
        </button>
      </form>
      {state.error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
    </section>
  );
}
