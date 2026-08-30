"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createProfessionAction, type TaxonomyActionResult } from "../../actions";

const INITIAL_STATE: TaxonomyActionResult = { ok: false };

export default function CreateProfessionForm() {
  const [state, formAction, pending] = useActionState<TaxonomyActionResult, FormData>(
    createProfessionAction,
    INITIAL_STATE,
  );

  if (state.ok && state.redirect) {
    return (
      <section className="rounded-lg border border-green-200 bg-green-50 p-4">
        <h2 className="text-lg font-semibold text-green-900">Profession created</h2>
        <p className="mt-2 text-sm text-green-800">
          The profession was created successfully.
        </p>
        <Link
          href="/admin/taxonomy/professions"
          className="mt-3 inline-block text-sm font-medium text-green-800 underline"
        >
          &larr; Back to professions
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-neutral-200 p-4">
      <h2 className="text-lg font-semibold">New profession</h2>
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
            placeholder="e.g. software-engineer"
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
          <label htmlFor="categoryId" className="block text-sm font-medium text-neutral-700">
            Category ID (optional)
          </label>
          <input
            id="categoryId"
            name="categoryId"
            type="text"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-mono"
            placeholder="UUID or leave empty"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-40"
        >
          Create profession
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
