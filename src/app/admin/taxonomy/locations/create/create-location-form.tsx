"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createLocationAction, type TaxonomyActionResult } from "../../actions";

const INITIAL_STATE: TaxonomyActionResult = { ok: false };

const LOCATION_TYPES = ["COUNTRY", "REGION", "CITY", "DISTRICT", "OTHER"];

export default function CreateLocationForm() {
  const [state, formAction, pending] = useActionState<TaxonomyActionResult, FormData>(
    createLocationAction,
    INITIAL_STATE,
  );

  if (state.ok && state.redirect) {
    return (
      <section className="rounded-lg border border-green-200 bg-green-50 p-4">
        <h2 className="text-lg font-semibold text-green-900">Location created</h2>
        <p className="mt-2 text-sm text-green-800">
          The location was created successfully.
        </p>
        <Link
          href="/admin/taxonomy/locations"
          className="mt-3 inline-block text-sm font-medium text-green-800 underline"
        >
          &larr; Back to locations
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-neutral-200 p-4">
      <h2 className="text-lg font-semibold">New location</h2>
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
            placeholder="e.g. addis-ababa"
          />
        </div>

        <div>
          <label htmlFor="type" className="block text-sm font-medium text-neutral-700">
            Type
          </label>
          <select
            id="type"
            name="type"
            required
            defaultValue=""
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Select a type
            </option>
            {LOCATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="parentId" className="block text-sm font-medium text-neutral-700">
            Parent location ID (optional)
          </label>
          <input
            id="parentId"
            name="parentId"
            type="text"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-mono"
            placeholder="UUID or leave empty for root"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="latitude" className="block text-sm font-medium text-neutral-700">
              Latitude
            </label>
            <input
              id="latitude"
              name="latitude"
              type="number"
              step="any"
              min="-90"
              max="90"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="longitude" className="block text-sm font-medium text-neutral-700">
              Longitude
            </label>
            <input
              id="longitude"
              name="longitude"
              type="number"
              step="any"
              min="-180"
              max="180"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-40"
        >
          Create location
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
