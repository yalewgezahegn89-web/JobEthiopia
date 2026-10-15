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
      <section className="mt-6 rounded-xl border border-border bg-success-light p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-success">Profession created</h2>
        <p className="mt-2 text-sm text-muted">
          The profession was created successfully.
        </p>
        <Link
          href="/admin/taxonomy/professions"
          className="mt-3 inline-block text-sm font-medium text-success hover:text-primary"
        >
          &larr; Back to professions
        </Link>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">New profession</h2>
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
            placeholder="e.g. software-engineer"
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
          <label htmlFor="categoryId" className="block text-sm font-medium text-foreground">
            Category ID (optional)
          </label>
          <input
            id="categoryId"
            name="categoryId"
            type="text"
            className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground font-mono focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            placeholder="UUID or leave empty"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
        >
          Create profession
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
