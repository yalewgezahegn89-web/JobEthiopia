"use client";

import { useActionState } from "react";
import { updateProfileAction, type ProfileActionResult } from "@/app/profile/actions";
import type { Dictionary } from "@/lib/i18n/dictionary";

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
  t: Dictionary;
};

const INITIAL_STATE: ProfileActionResult = { ok: false };

const inputClass =
  "mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const readonlyClass =
  "mt-1.5 w-full rounded-lg border border-border bg-surface-raised px-3 py-2.5 text-sm text-subtle";

const labelClass = "block text-sm font-medium text-foreground";

export function ProfileForm({
  name,
  email,
  phone,
  locationId,
  professionalSummary,
  totalExperienceYears,
  education,
  locations,
  t,
}: ProfileFormProps) {
  const [state, formAction, isPending] = useActionState<
    ProfileActionResult,
    FormData
  >(updateProfileAction, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
          {t.profile.form.basicHeading}
        </h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="profile-name" className={labelClass}>{t.profile.form.nameLabel}</label>
            <input
              id="profile-name"
              type="text"
              value={name}
              readOnly
              disabled
              className={readonlyClass}
            />
            <p className="mt-1 text-xs text-subtle">
              {t.profile.form.nameHint}
            </p>
          </div>
          <div>
            <label htmlFor="profile-email" className={labelClass}>{t.profile.form.emailLabel}</label>
            <input
              id="profile-email"
              type="email"
              value={email}
              readOnly
              disabled
              className={readonlyClass}
            />
            <p className="mt-1 text-xs text-subtle">
              {t.profile.form.emailHint}
            </p>
          </div>
          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-foreground"
            >
              {t.profile.form.phoneLabel}
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={phone ?? ""}
              placeholder={t.profile.form.phonePlaceholder}
              className={inputClass}
            />
            {state.fieldErrors?.phone ? (
              <p role="alert" className="mt-1.5 text-sm text-destructive">
                {state.fieldErrors.phone}
              </p>
            ) : null}
          </div>
          <div>
            <label
              htmlFor="locationId"
              className="block text-sm font-medium text-foreground"
            >
              {t.profile.form.locationLabel}
            </label>
            <select
              id="locationId"
              name="locationId"
              defaultValue={locationId ?? ""}
              className={inputClass}
            >
              <option value="">{t.profile.form.locationPlaceholder}</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
            {state.fieldErrors?.locationId ? (
              <p role="alert" className="mt-1.5 text-sm text-destructive">
                {state.fieldErrors.locationId}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="border-t border-border-subtle pt-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
          {t.profile.form.professionalHeading}
        </h3>
        <div className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="professionalSummary"
              className="block text-sm font-medium text-foreground"
            >
              {t.profile.form.summaryLabel}
            </label>
            <textarea
              id="professionalSummary"
              name="professionalSummary"
              rows={4}
              defaultValue={professionalSummary ?? ""}
              maxLength={1000}
              placeholder={t.profile.form.summaryPlaceholder}
              className={inputClass}
            />
            {state.fieldErrors?.professionalSummary ? (
              <p role="alert" className="mt-1.5 text-sm text-destructive">
                {state.fieldErrors.professionalSummary}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="totalExperienceYears"
                className="block text-sm font-medium text-foreground"
              >
                {t.profile.form.experienceLabel}
              </label>
              <input
                id="totalExperienceYears"
                name="totalExperienceYears"
                type="number"
                min={0}
                max={60}
                step={1}
                defaultValue={totalExperienceYears ?? ""}
                className={inputClass}
              />
              {state.fieldErrors?.totalExperienceYears ? (
                <p role="alert" className="mt-1.5 text-sm text-destructive">
                  {state.fieldErrors.totalExperienceYears}
                </p>
              ) : null}
            </div>
            <div>
              <label
                htmlFor="education"
                className="block text-sm font-medium text-foreground"
              >
                {t.profile.form.educationLabel}
              </label>
              <input
                id="education"
                name="education"
                type="text"
                defaultValue={education ?? ""}
                maxLength={200}
                placeholder={t.profile.form.educationPlaceholder}
                className={inputClass}
              />
              {state.fieldErrors?.education ? (
                <p role="alert" className="mt-1.5 text-sm text-destructive">
                  {state.fieldErrors.education}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-sm font-medium text-success">
          {t.profile.form.savedSuccess}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? t.profile.form.saving : t.profile.form.saveCta}
      </button>
    </form>
  );
}