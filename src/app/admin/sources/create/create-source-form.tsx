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
      <section className="rounded-lg border border-green-200 bg-green-50 p-4">
        <h2 className="text-lg font-semibold text-green-900">Source created</h2>
        <p className="mt-2 text-sm text-green-800">
          The source was created successfully.
        </p>
        <Link
          href="/admin/sources"
          className="mt-3 inline-block text-sm font-medium text-green-800 underline"
        >
          &larr; Back to sources
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-neutral-200 p-4">
      <h2 className="text-lg font-semibold">New source</h2>
      <form action={createFormAction} className="mt-3 space-y-3">
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
            placeholder="e.g. Ethiopian Reporter"
          />
        </div>

        <div>
          <label htmlFor="sourceType" className="block text-sm font-medium text-neutral-700">
            Source type
          </label>
          <select
            id="sourceType"
            name="sourceType"
            required
            defaultValue=""
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
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
          <label htmlFor="baseUrl" className="block text-sm font-medium text-neutral-700">
            Base URL
          </label>
          <input
            id="baseUrl"
            name="baseUrl"
            type="url"
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
            required
            defaultValue="MEDIUM"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
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
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-40"
        >
          Create source
        </button>
      </form>
      {createState.error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {createState.error}
        </p>
      )}
    </section>
  );
}