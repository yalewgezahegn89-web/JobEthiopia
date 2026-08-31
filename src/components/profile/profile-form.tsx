"use client";

import { useActionState } from "react";
import { updateProfileAction, type ProfileActionResult } from "@/app/profile/actions";

type LocationOption = {
  id: string;
  name: string;
};

type ProfileFormProps = {
  name: string;
  email: string;
  phone: string | null;
  locationId: string | null;
  professionalSummary: string | null;
  totalExperienceYears: number | null;
  education: string | null;
  locations: LocationOption[];
};

const INITIAL_STATE: ProfileActionResult = { ok: false };

export function ProfileForm({
  name,
  email,
  phone,
  locationId,
  professionalSummary,
  totalExperienceYears,
  education,
  locations,
}: ProfileFormProps) {
  const [state, formAction, isPending] = useActionState<
    ProfileActionResult,
    FormData
  >(updateProfileAction, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Name
          </label>
          <input
            type="text"
            value={name}
            readOnly
            disabled
            className="mt-1 w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Your name comes from your account and cannot be changed here.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Email
          </label>
          <input
            type="email"
            value={email}
            readOnly
            disabled
            className="mt-1 w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Your sign-in email cannot be changed here.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="phone"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={phone ?? ""}
            placeholder="e.g. +251 911 234 567"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
          />
          {state.fieldErrors?.phone ? (
            <p role="alert" className="mt-1 text-sm text-red-600">
              {state.fieldErrors.phone}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="locationId"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Location
          </label>
          <select
            id="locationId"
            name="locationId"
            defaultValue={locationId ?? ""}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
          >
            <option value="">Select a location</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
          {state.fieldErrors?.locationId ? (
            <p role="alert" className="mt-1 text-sm text-red-600">
              {state.fieldErrors.locationId}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <label
          htmlFor="professionalSummary"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Professional summary
        </label>
        <textarea
          id="professionalSummary"
          name="professionalSummary"
          rows={4}
          defaultValue={professionalSummary ?? ""}
          maxLength={1000}
          placeholder="A short summary of who you are and what you do."
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
        />
        {state.fieldErrors?.professionalSummary ? (
          <p role="alert" className="mt-1 text-sm text-red-600">
            {state.fieldErrors.professionalSummary}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="totalExperienceYears"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Total experience (years)
          </label>
          <input
            id="totalExperienceYears"
            name="totalExperienceYears"
            type="number"
            min={0}
            max={60}
            step={1}
            defaultValue={totalExperienceYears ?? ""}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
          />
          {state.fieldErrors?.totalExperienceYears ? (
            <p role="alert" className="mt-1 text-sm text-red-600">
              {state.fieldErrors.totalExperienceYears}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="education"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Education
          </label>
          <input
            id="education"
            name="education"
            type="text"
            defaultValue={education ?? ""}
            maxLength={200}
            placeholder="e.g. BSc in Computer Science"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
          />
          {state.fieldErrors?.education ? (
            <p role="alert" className="mt-1 text-sm text-red-600">
              {state.fieldErrors.education}
            </p>
          ) : null}
        </div>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="alert" className="text-sm text-green-700">
          Profile saved successfully.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-600"
      >
        {isPending ? "Saving…" : "Save Profile"}
      </button>
    </form>
  );
}
