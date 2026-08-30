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
      <section className="rounded-lg border border-green-200 bg-green-50 p-4">
        <h2 className="text-lg font-semibold text-green-900">Category created</h2>
        <p className="mt-2 text-sm text-green-800">
          The category was created successfully.
        </p>
        <Link
          href="/admin/taxonomy/categories"
          className="mt-3 inline-block text-sm font-medium text-green-800 underline"
        >
          &larr; Back to categories
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-neutral-200 p-4">
      <h2 className="text-lg font-semibold">New category</h2>
      <form action={formAction} className="mt-3 space-y-3">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-neutral-700">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
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
            required
            pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-mono"
            placeholder="e.g. engineering"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-neutral-700">
            Description
          </label>
          <textarea
            id="description"
            name="description"
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
            defaultValue={0}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-40"
        >
          Create category
        </button>
      </form>
      {state.error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
    </section>
  );
}
