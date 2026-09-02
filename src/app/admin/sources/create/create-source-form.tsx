"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createSourceAction, type SourceActionResult } from "../actions";

const INITIAL_STATE: SourceActionResult = { ok: false };

const SOURCE_TYPES = ["MANUAL", "WEBSITE", "API", "FEED", "EMPLOYER", "OTHER"];
const TRUST_LEVELS = ["HIGH", "MEDIUM", "LOW"];

export default function CreateSourceForm() {
  const [createState, createFormAction, createPending] = useActionState<
    SourceActionResult,
    FormData
  >(createSourceAction, INITIAL_STATE);

  if (createState.ok) {
    return (
      <section className="mt-6 rounded-xl border border-border bg-success-light p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-success">Source created</h2>
        <p className="mt-2 text-sm text-muted">
          The source was created successfully.
        </p>
        <Link
          href="/admin/sources"
          className="mt-3 inline-block text-sm font-medium text-success hover:text-primary"
        >
          &larr; Back to sources
        </Link>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">New source</h2>
      <form action={createFormAction} className="mt-4 space-y-4">
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
            placeholder="e.g. Ethiopian Reporter"
          />
        </div>

        <div>
          <label htmlFor="sourceType" className="block text-sm font-medium text-foreground">
            Source type
          </label>
          <select
            id="sourceType"
            name="sourceType"
            required
            defaultValue=""
            className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <option value="" disabled>
              Select a source type
            </option>
            {SOURCE_TYPES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
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
            required
            defaultValue="MEDIUM"
            className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {TRUST_LEVELS.map((tl) => (
              <option key={tl} value={tl}>
                {tl}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={createPending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
        >
          Create source
        </button>
      </form>
      {createState.error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {createState.error}
        </p>
      )}
    </section>
  );
}