"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  createCuratedJobAction,
  type CreateCuratedJobActionResult,
} from "../actions";
import type { JobCreateOptions } from "./page";

const EMPLOYMENT_TYPES = [
  "FULL_TIME",
  "PART_TIME",
  "CONTRACT",
  "TEMPORARY",
  "INTERNSHIP",
  "VOLUNTEER",
  "FREELANCE",
  "OTHER",
];
const SALARY_PERIODS = ["HOURLY", "DAILY", "MONTHLY", "YEARLY", "OTHER"];

const INITIAL_STATE: CreateCuratedJobActionResult = { ok: false };

const inputClass =
  "mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const labelClass = "block text-sm font-medium text-foreground";

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-primary">
        {title}
      </h2>
      {description && <p className="mt-1 text-xs text-muted">{description}</p>}
    </div>
  );
}

function RequiredMark() {
  return (
    <span className="ml-0.5 text-destructive" aria-hidden="true">
      *
    </span>
  );
}

function OptionalLabel() {
  return <span className="ml-1 text-xs font-normal text-subtle">Optional</span>;
}

function FieldError({
  id,
  message,
}: {
  id: string;
  message?: string;
}) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-sm text-destructive">
      {message}
    </p>
  );
}

export default function JobCreateForm({
  organizations,
  categories,
  professions,
  locations,
  initialState = INITIAL_STATE,
}: JobCreateOptions & {
  initialState?: CreateCuratedJobActionResult;
}) {
  const [state, formAction, isPending] = useActionState<
    CreateCuratedJobActionResult,
    FormData
  >(createCuratedJobAction, initialState);

  const fieldError = (name: string): string | undefined => {
    if (state.ok) return undefined;
    const errors = state.fieldErrors?.[name];
    return errors && errors.length > 0 ? errors[0] : undefined;
  };

  const errorProps = (name: string) => {
    const message = fieldError(name);
    return {
      "aria-invalid": message ? true : undefined,
      "aria-describedby": message ? `${name}-error` : undefined,
    };
  };

  const originalSourceError = (): string | undefined => {
    if (state.ok) return undefined;
    for (const [key, messages] of Object.entries(state.fieldErrors ?? {})) {
      if (key.startsWith("originalSource") && messages && messages.length > 0) {
        return messages[0];
      }
    }
    return undefined;
  };

  return (
    <form
      action={formAction}
      className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
    >
      <div className="h-1.5 w-full bg-primary" aria-hidden="true" />

      <div className="space-y-8 p-6">
        <div>
          <SectionHeading
            title="Organization"
            description="Required. Jobs are always attributed to an organization."
          />
          <div className="mt-3">
            <label htmlFor="organizationId" className={labelClass}>
              Organization
              <RequiredMark />
            </label>
            <select
              id="organizationId"
              name="organizationId"
              required
              className={inputClass}
              {...errorProps("organizationId")}
            >
              <option value="">Select an organization</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
            <FieldError id="organizationId-error" message={fieldError("organizationId")} />
          </div>
        </div>

        <div className="space-y-6">
          <SectionHeading title="Basic information" />
          <div>
            <label htmlFor="title" className={labelClass}>
              Title
              <RequiredMark />
            </label>
            <input
              id="title"
              name="title"
              required
              className={inputClass}
              placeholder="e.g. ከፍተኛ አካውንታንት / Senior Accountant"
              {...errorProps("title")}
            />
            <FieldError id="title-error" message={fieldError("title")} />
          </div>

          <div>
            <label htmlFor="description" className={labelClass}>
              Description
              <RequiredMark />
            </label>
            <textarea
              id="description"
              name="description"
              required
              rows={6}
              className={inputClass}
              placeholder="Describe the role and what you are looking for."
              {...errorProps("description")}
            />
            <FieldError id="description-error" message={fieldError("description")} />
          </div>
        </div>

        <div className="space-y-6 border-t border-border-subtle pt-6">
          <SectionHeading
            title="Classification"
            description="Categorize this role for candidates and search."
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="categoryId" className={labelClass}>
                Category<OptionalLabel />
              </label>
              <select id="categoryId" name="categoryId" className={inputClass} {...errorProps("categoryId")}>
                <option value="">Select a category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <FieldError id="categoryId-error" message={fieldError("categoryId")} />
            </div>
            <div>
              <label htmlFor="professionId" className={labelClass}>
                Profession<OptionalLabel />
              </label>
              <select id="professionId" name="professionId" className={inputClass} {...errorProps("professionId")}>
                <option value="">Select a profession</option>
                {professions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <FieldError id="professionId-error" message={fieldError("professionId")} />
            </div>
            <div>
              <label htmlFor="locationId" className={labelClass}>
                Location<OptionalLabel />
              </label>
              <select id="locationId" name="locationId" className={inputClass} {...errorProps("locationId")}>
                <option value="">Select a location</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <FieldError id="locationId-error" message={fieldError("locationId")} />
            </div>
            <div>
              <label htmlFor="employmentType" className={labelClass}>
                Employment type<OptionalLabel />
              </label>
              <select id="employmentType" name="employmentType" className={inputClass} {...errorProps("employmentType")}>
                <option value="">Select...</option>
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <FieldError id="employmentType-error" message={fieldError("employmentType")} />
            </div>
          </div>
        </div>

        <div className="space-y-6 border-t border-border-subtle pt-6">
          <SectionHeading
            title="Experience and compensation"
            description="Optional details about seniority and pay."
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="experienceMin" className={labelClass}>
                Experience min (years)<OptionalLabel />
              </label>
              <input
                id="experienceMin"
                name="experienceMin"
                type="number"
                min="0"
                className={inputClass}
                {...errorProps("experienceMin")}
              />
              <FieldError id="experienceMin-error" message={fieldError("experienceMin")} />
            </div>
            <div>
              <label htmlFor="experienceMax" className={labelClass}>
                Experience max (years)<OptionalLabel />
              </label>
              <input
                id="experienceMax"
                name="experienceMax"
                type="number"
                min="0"
                className={inputClass}
                {...errorProps("experienceMax")}
              />
              <FieldError id="experienceMax-error" message={fieldError("experienceMax")} />
            </div>
            <div>
              <label htmlFor="salaryMin" className={labelClass}>
                Salary min<OptionalLabel />
              </label>
              <input
                id="salaryMin"
                name="salaryMin"
                type="number"
                min="0"
                className={inputClass}
                {...errorProps("salaryMin")}
              />
              <FieldError id="salaryMin-error" message={fieldError("salaryMin")} />
            </div>
            <div>
              <label htmlFor="salaryMax" className={labelClass}>
                Salary max<OptionalLabel />
              </label>
              <input
                id="salaryMax"
                name="salaryMax"
                type="number"
                min="0"
                className={inputClass}
                {...errorProps("salaryMax")}
              />
              <FieldError id="salaryMax-error" message={fieldError("salaryMax")} />
            </div>
            <div>
              <label htmlFor="salaryCurrency" className={labelClass}>
                Salary currency<OptionalLabel />
              </label>
              <input
                id="salaryCurrency"
                name="salaryCurrency"
                className={inputClass}
                placeholder="ETB"
                {...errorProps("salaryCurrency")}
              />
              <FieldError id="salaryCurrency-error" message={fieldError("salaryCurrency")} />
            </div>
            <div>
              <label htmlFor="salaryPeriod" className={labelClass}>
                Salary period<OptionalLabel />
              </label>
              <select id="salaryPeriod" name="salaryPeriod" className={inputClass} {...errorProps("salaryPeriod")}>
                <option value="">Select...</option>
                {SALARY_PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <FieldError id="salaryPeriod-error" message={fieldError("salaryPeriod")} />
            </div>
          </div>
        </div>

        <div className="space-y-6 border-t border-border-subtle pt-6">
          <SectionHeading
            title="Timing and application"
            description="Set when applications close and where to apply."
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="deadline" className={labelClass}>
                Deadline<OptionalLabel />
              </label>
              <input
                id="deadline"
                name="deadline"
                type="datetime-local"
                className={inputClass}
                {...errorProps("deadline")}
              />
              <FieldError id="deadline-error" message={fieldError("deadline")} />
            </div>
            <div>
              <label htmlFor="applicationUrl" className={labelClass}>
                Application URL<OptionalLabel />
              </label>
              <input
                id="applicationUrl"
                name="applicationUrl"
                type="url"
                className={inputClass}
                placeholder="https://..."
                {...errorProps("applicationUrl")}
              />
              <FieldError id="applicationUrl-error" message={fieldError("applicationUrl")} />
            </div>
          </div>
        </div>

        <div className="space-y-6 border-t border-border-subtle pt-6">
          <SectionHeading
            title="Original vacancy source"
            description="Optional — for real vacancies already verified on an official employer site (e.g. UNICEF or UNFPA careers pages)."
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="originalSourceName" className={labelClass}>
                Source site name<OptionalLabel />
              </label>
              <input
                id="originalSourceName"
                name="originalSourceName"
                className={inputClass}
                placeholder="e.g. UNICEF Careers Website"
                {...errorProps("originalSourceName")}
              />
              <FieldError id="originalSourceName-error" message={fieldError("originalSourceName")} />
            </div>
            <div>
              <label htmlFor="originalSourceUrl" className={labelClass}>
                Official vacancy URL<OptionalLabel />
              </label>
              <input
                id="originalSourceUrl"
                name="originalSourceUrl"
                type="url"
                className={inputClass}
                placeholder="https://..."
                {...errorProps("originalSourceUrl")}
              />
              <FieldError id="originalSourceUrl-error" message={fieldError("originalSourceUrl")} />
            </div>
            <div>
              <label htmlFor="originalExternalId" className={labelClass}>
                Employer vacancy reference<OptionalLabel />
              </label>
              <input
                id="originalExternalId"
                name="originalExternalId"
                className={inputClass}
                placeholder="e.g. 595227"
                {...errorProps("originalExternalId")}
              />
              <FieldError id="originalExternalId-error" message={fieldError("originalExternalId")} />
            </div>
          </div>
          {originalSourceError() ? (
            <p role="alert" className="text-sm text-destructive">
              {originalSourceError()}
            </p>
          ) : null}
          <p className="text-xs text-muted">
            When the site name and official URL are provided, the vacancy is
            recorded with both the internal data-entry method and the original
            external source: the publisher, vacancy URL and reference become the
            representative provenance so the original source stays visible in
            moderation.
          </p>
        </div>

        <div className="space-y-6 border-t border-border-subtle pt-6">
          <SectionHeading
            title="Additional details"
            description="Optional content to help candidates apply."
          />

          <div>
            <label htmlFor="responsibilities" className={labelClass}>
              Responsibilities<OptionalLabel />
            </label>
            <textarea
              id="responsibilities"
              name="responsibilities"
              rows={3}
              className={inputClass}
              {...errorProps("responsibilities")}
            />
            <FieldError id="responsibilities-error" message={fieldError("responsibilities")} />
          </div>
          <div>
            <label htmlFor="requirements" className={labelClass}>
              Requirements<OptionalLabel />
            </label>
            <textarea
              id="requirements"
              name="requirements"
              rows={3}
              className={inputClass}
              {...errorProps("requirements")}
            />
            <FieldError id="requirements-error" message={fieldError("requirements")} />
          </div>
          <div>
            <label htmlFor="educationRequirements" className={labelClass}>
              Education requirements<OptionalLabel />
            </label>
            <textarea
              id="educationRequirements"
              name="educationRequirements"
              rows={3}
              className={inputClass}
              {...errorProps("educationRequirements")}
            />
            <FieldError id="educationRequirements-error" message={fieldError("educationRequirements")} />
          </div>
          <div>
            <label htmlFor="benefits" className={labelClass}>
              Benefits<OptionalLabel />
            </label>
            <textarea
              id="benefits"
              name="benefits"
              rows={3}
              className={inputClass}
              {...errorProps("benefits")}
            />
            <FieldError id="benefits-error" message={fieldError("benefits")} />
          </div>
        </div>

        <div
          className="rounded-lg bg-surface-raised px-4 py-3 text-sm text-muted"
          role="note"
        >
          This creates a <strong>DRAFT</strong> job with{" "}
          <strong>PENDING</strong> verification and Manual provenance. If the
          original vacancy source is provided, the official site, URL and
          reference are preserved alongside as the representative provenance.
          After creating, you will be taken to the job detail page where the
          existing moderation workflow handles review and publishing.
        </div>

        {state.error && (
          <p
            role="alert"
            className="rounded-lg bg-destructive-light px-4 py-3 text-sm text-destructive"
          >
            {state.error}
          </p>
        )}

        {state.ok && state.warning ? (
          <div
            role="alert"
            className="rounded-lg border border-warning/30 bg-warning-light/40 px-4 py-3 text-sm"
          >
            <p className="font-semibold text-warning">
              {state.warning.message}
            </p>
            <p className="mt-1 text-muted">
              This job may match an existing {state.warning.matchedStatus}{" "}
              job &ldquo;{state.warning.matchedJobTitle ?? "untitled"}&rdquo;. Review
              the moderation queue before publishing this one.
            </p>
            {state.itemId ? (
              <Link
                href={`/admin/jobs/${state.itemId}`}
                className="mt-2 inline-block font-medium text-primary hover:underline"
              >
                View created job &rarr;
              </Link>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 border-t border-border-subtle pt-6">
          <button
            type="submit"
            disabled={isPending}
            className={`inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
          >
            {isPending ? "Creating..." : "Create Draft"}
          </button>
        </div>
      </div>
    </form>
  );
}