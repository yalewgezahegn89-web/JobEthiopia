"use client";

import { useActionState } from "react";
import {
  updateLocationAction,
  deleteLocationAction,
  toggleLocationActiveAction,
  type TaxonomyActionResult,
} from "../../actions";

const INITIAL_STATE: TaxonomyActionResult = { ok: false };

const LOCATION_TYPES = ["COUNTRY", "REGION", "CITY", "DISTRICT", "OTHER"];

type LocationDetailProps = {
  location: {
    id: string;
    name: string;
    slug: string;
    type: string;
    parentId: string | null;
    parentName: string | null;
    latitude: string | null;
    longitude: string | null;
    isActive: boolean;
    jobCount: number;
    childCount: number;
  };
};

export default function LocationDetail({ location }: LocationDetailProps) {
  const [updateState, updateFormAction, updatePending] = useActionState<TaxonomyActionResult, FormData>(
    updateLocationAction,
    INITIAL_STATE,
  );
  const [deleteState, deleteFormAction, deletePending] = useActionState<TaxonomyActionResult, FormData>(
    deleteLocationAction,
    INITIAL_STATE,
  );
  const [toggleState, toggleFormAction, togglePending] = useActionState<TaxonomyActionResult, FormData>(
    toggleLocationActiveAction,
    INITIAL_STATE,
  );

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-lg font-semibold">Actions</h2>

        <form action={toggleFormAction} className="mt-3">
          <input type="hidden" name="locationId" value={location.id} />
          <button
            type="submit"
            disabled={togglePending}
            className={`rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 ${
              location.isActive
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {location.isActive ? "Deactivate" : "Activate"}
          </button>
        </form>
        {toggleState.error && (
          <p role="alert" className="mt-2 text-sm text-red-700">{toggleState.error}</p>
        )}

        <form
          action={deleteFormAction}
          onSubmit={(e) => {
            const impact = [];
            if (location.jobCount > 0) impact.push(`${location.jobCount} job${location.jobCount === 1 ? "" : "s"}`);
            if (location.childCount > 0) impact.push(`${location.childCount} child${location.childCount === 1 ? "" : "ren"}`);
            const msg = impact.length > 0
              ? `Deleting this location will remove its association from ${impact.join(", ")}. Are you sure you want to permanently delete this location?`
              : "Are you sure you want to permanently delete this location? This cannot be undone.";
            if (!confirm(msg)) {
              e.preventDefault();
            }
          }}
          className="mt-3"
        >
          <input type="hidden" name="locationId" value={location.id} />
          <button
            type="submit"
            disabled={deletePending}
            className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-40"
          >
            Delete location
          </button>
        </form>
        {deleteState.error && (
          <p role="alert" className="mt-2 text-sm text-red-700">{deleteState.error}</p>
        )}
      </section>

      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-lg font-semibold">Edit location</h2>
        <form action={updateFormAction} className="mt-3 space-y-3">
          <input type="hidden" name="locationId" value={location.id} />

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-neutral-700">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={location.name}
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
              defaultValue={location.slug}
              required
              pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-mono"
            />
          </div>

          <div>
            <label htmlFor="type" className="block text-sm font-medium text-neutral-700">
              Type
            </label>
            <select
              id="type"
              name="type"
              defaultValue={location.type}
              required
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            >
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
              defaultValue={location.parentId ?? ""}
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
                defaultValue={location.latitude ?? ""}
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
                defaultValue={location.longitude ?? ""}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
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
