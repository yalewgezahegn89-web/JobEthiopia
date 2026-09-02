"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const inputClass =
  "mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const labelClass = "block text-sm font-medium text-foreground";

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
      {description && (
        <p className="mt-1 text-xs text-muted">{description}</p>
      )}
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
  return (
    <span className="ml-1 text-xs font-normal text-subtle">Optional</span>
  );
}

export function CreateJobForm({
  organizations,
}: {
  organizations: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const data: Record<string, unknown> = {
      organizationId: form.get("organizationId"),
      title: form.get("title"),
      description: form.get("description"),
    };

    const optionalFields = [
      "categoryId",
      "professionId",
      "locationId",
      "responsibilities",
      "requirements",
      "educationRequirements",
      "benefits",
      "employmentType",
      "salaryCurrency",
      "salaryPeriod",
      "postedAt",
      "deadline",
      "applicationUrl",
    ];
    for (const field of optionalFields) {
      const val = form.get(field);
      if (val && typeof val === "string" && val.trim() !== "") {
        data[field] = val.trim();
      }
    }

    const numFields = ["experienceMin", "experienceMax", "salaryMin", "salaryMax"];
    for (const field of numFields) {
      const val = form.get(field);
      if (val && typeof val === "string" && val.trim() !== "") {
        data[field] = Number(val);
      }
    }

    try {
      const res = await fetch("/api/employer/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Failed to create job");
        setLoading(false);
        return;
      }

      const result = await res.json();
      router.push(`/organization/jobs/${result.item.id}`);
    } catch {
      setError("Failed to create job");
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
    >
      <div className="h-1.5 w-full bg-primary" aria-hidden="true" />

      <div className="space-y-8 p-6">
        {organizations.length > 1 ? (
          <div>
            <SectionHeading title="Organization" description="Required" />
            <div className="mt-3">
              <label htmlFor="organizationId" className="sr-only">
                Organization
              </label>
              <select
                id="organizationId"
                name="organizationId"
                required
                className={inputClass}
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <input
            type="hidden"
            name="organizationId"
            value={organizations[0].id}
          />
        )}

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
              placeholder="e.g. Senior Accountant"
            />
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
            />
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
                Category ID<OptionalLabel />
              </label>
              <input
                id="categoryId"
                name="categoryId"
                className={inputClass}
                placeholder="UUID"
              />
            </div>
            <div>
              <label htmlFor="professionId" className={labelClass}>
                Profession ID<OptionalLabel />
              </label>
              <input
                id="professionId"
                name="professionId"
                className={inputClass}
                placeholder="UUID"
              />
            </div>
            <div>
              <label htmlFor="locationId" className={labelClass}>
                Location ID<OptionalLabel />
              </label>
              <input
                id="locationId"
                name="locationId"
                className={inputClass}
                placeholder="UUID"
              />
            </div>
            <div>
              <label htmlFor="employmentType" className={labelClass}>
                Employment type<OptionalLabel />
              </label>
              <select
                id="employmentType"
                name="employmentType"
                className={inputClass}
              >
                <option value="">Select...</option>
                <option value="FULL_TIME">Full Time</option>
                <option value="PART_TIME">Part Time</option>
                <option value="CONTRACT">Contract</option>
                <option value="TEMPORARY">Temporary</option>
                <option value="INTERNSHIP">Internship</option>
                <option value="VOLUNTEER">Volunteer</option>
                <option value="FREELANCE">Freelance</option>
                <option value="OTHER">Other</option>
              </select>
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
              />
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
              />
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
              />
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
              />
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
              />
            </div>
            <div>
              <label htmlFor="salaryPeriod" className={labelClass}>
                Salary period<OptionalLabel />
              </label>
              <select
                id="salaryPeriod"
                name="salaryPeriod"
                className={inputClass}
              >
                <option value="">Select...</option>
                <option value="HOURLY">Hourly</option>
                <option value="DAILY">Daily</option>
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
                <option value="OTHER">Other</option>
              </select>
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
              />
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
              />
            </div>
          </div>
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
            />
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
            />
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
            />
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
            />
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-destructive-light px-4 py-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-border-subtle pt-6">
          <button
            type="submit"
            disabled={loading}
            className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Creating..." : "Create Job"}
          </button>
          <Link
            href="/organization/jobs"
            className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg border border-border bg-surface px-6 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Cancel
          </Link>
        </div>
      </div>
    </form>
  );
}
