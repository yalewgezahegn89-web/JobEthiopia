"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

const JOB_STATUS_META: Record<
  string,
  { label: string; variant: "default" | "success" | "warning" | "destructive" | "info" }
> = {
  DRAFT: { label: "Draft", variant: "default" },
  PENDING_REVIEW: { label: "Pending review", variant: "warning" },
  PUBLISHED: { label: "Published", variant: "success" },
  EXPIRED: { label: "Expired", variant: "destructive" },
  REMOVED: { label: "Removed", variant: "destructive" },
};

type Job = {
  id: string;
  title: string;
  description: string;
  responsibilities: string | null;
  requirements: string | null;
  educationRequirements: string | null;
  benefits: string | null;
  categoryId: string | null;
  professionId: string | null;
  locationId: string | null;
  experienceMin: number | null;
  experienceMax: number | null;
  employmentType: string | null;
  salaryMin: string | null;
  salaryMax: string | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
  deadline: Date | null;
  applicationUrl: string | null;
  postedAt: Date | null;
  organizationName: string;
  status: string;
};

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

function toDatetimeLocal(date: Date | null): string {
  if (!date) return "";
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EditJobForm({ job }: { job: Job }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const data: Record<string, unknown> = {};

    const stringFields = [
      "title",
      "description",
      "responsibilities",
      "requirements",
      "educationRequirements",
      "benefits",
      "categoryId",
      "professionId",
      "locationId",
      "employmentType",
      "salaryCurrency",
      "salaryPeriod",
      "applicationUrl",
    ];
    for (const field of stringFields) {
      const val = form.get(field);
      if (val && typeof val === "string" && val.trim() !== "") {
        data[field] = val.trim();
      } else if (field !== "title" && field !== "description") {
        data[field] = null;
      }
    }

    const numFields = ["experienceMin", "experienceMax", "salaryMin", "salaryMax"];
    for (const field of numFields) {
      const val = form.get(field);
      if (val && typeof val === "string" && val.trim() !== "") {
        data[field] = Number(val);
      } else {
        data[field] = null;
      }
    }

    const deadline = form.get("deadline");
    if (deadline && typeof deadline === "string" && deadline.trim() !== "") {
      data.deadline = new Date(deadline).toISOString();
    } else {
      data.deadline = null;
    }

    const postedAt = form.get("postedAt");
    if (postedAt && typeof postedAt === "string" && postedAt.trim() !== "") {
      data.postedAt = new Date(postedAt).toISOString();
    } else {
      data.postedAt = null;
    }

    try {
      const res = await fetch(`/api/employer/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Failed to update job");
        setLoading(false);
        return;
      }

      router.push(`/organization/jobs/${job.id}`);
    } catch {
      setError("Failed to update job");
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
    >
      <div className="h-1.5 w-full bg-primary" aria-hidden="true" />

      <div className="border-b border-border bg-surface-raised px-6 py-4">
        <dl className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-subtle">
              Organization
            </dt>
            <dd className="mt-0.5 font-semibold text-foreground">
              {job.organizationName}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-subtle">
              Status
            </dt>
            <dd className="mt-0.5">
              {(() => {
                const meta = JOB_STATUS_META[job.status] ?? {
                  label: job.status.replace("_", " "),
                  variant: "default" as const,
                };
                return (
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                );
              })()}
            </dd>
          </div>
        </dl>
      </div>

      <div className="space-y-8 p-6">
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
              defaultValue={job.title}
              className={inputClass}
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
              defaultValue={job.description}
              className={inputClass}
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
                defaultValue={job.categoryId ?? ""}
                className={inputClass}
                placeholder="UUID or empty"
              />
            </div>
            <div>
              <label htmlFor="professionId" className={labelClass}>
                Profession ID<OptionalLabel />
              </label>
              <input
                id="professionId"
                name="professionId"
                defaultValue={job.professionId ?? ""}
                className={inputClass}
                placeholder="UUID or empty"
              />
            </div>
            <div>
              <label htmlFor="locationId" className={labelClass}>
                Location ID<OptionalLabel />
              </label>
              <input
                id="locationId"
                name="locationId"
                defaultValue={job.locationId ?? ""}
                className={inputClass}
                placeholder="UUID or empty"
              />
            </div>
            <div>
              <label htmlFor="employmentType" className={labelClass}>
                Employment type<OptionalLabel />
              </label>
              <select
                id="employmentType"
                name="employmentType"
                defaultValue={job.employmentType ?? ""}
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
                defaultValue={job.experienceMin ?? ""}
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
                defaultValue={job.experienceMax ?? ""}
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
                defaultValue={job.salaryMin ?? ""}
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
                defaultValue={job.salaryMax ?? ""}
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
                defaultValue={job.salaryCurrency ?? ""}
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
                defaultValue={job.salaryPeriod ?? ""}
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
                defaultValue={toDatetimeLocal(job.deadline)}
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
                defaultValue={job.applicationUrl ?? ""}
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
              defaultValue={job.responsibilities ?? ""}
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
              defaultValue={job.requirements ?? ""}
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
              defaultValue={job.educationRequirements ?? ""}
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
              defaultValue={job.benefits ?? ""}
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
            {loading ? "Saving..." : "Save Changes"}
          </button>
          <Link
            href={`/organization/jobs/${job.id}`}
            className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg border border-border bg-surface px-6 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Cancel
          </Link>
        </div>
      </div>
    </form>
  );
}
