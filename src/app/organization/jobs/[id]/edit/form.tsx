"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
        Organization: {job.organizationName} &middot; Status:{" "}
        {job.status.replace("_", " ")}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Title *
        </label>
        <input
          name="title"
          required
          defaultValue={job.title}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Description *
        </label>
        <textarea
          name="description"
          required
          rows={6}
          defaultValue={job.description}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Category ID
          </label>
          <input
            name="categoryId"
            defaultValue={job.categoryId ?? ""}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            placeholder="UUID or empty"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Profession ID
          </label>
          <input
            name="professionId"
            defaultValue={job.professionId ?? ""}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            placeholder="UUID or empty"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Location ID
          </label>
          <input
            name="locationId"
            defaultValue={job.locationId ?? ""}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            placeholder="UUID or empty"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Employment Type
          </label>
          <select
            name="employmentType"
            defaultValue={job.employmentType ?? ""}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Experience Min (years)
          </label>
          <input
            name="experienceMin"
            type="number"
            min="0"
            defaultValue={job.experienceMin ?? ""}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Experience Max (years)
          </label>
          <input
            name="experienceMax"
            type="number"
            min="0"
            defaultValue={job.experienceMax ?? ""}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Salary Min
          </label>
          <input
            name="salaryMin"
            type="number"
            min="0"
            defaultValue={job.salaryMin ?? ""}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Salary Max
          </label>
          <input
            name="salaryMax"
            type="number"
            min="0"
            defaultValue={job.salaryMax ?? ""}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Salary Currency
          </label>
          <input
            name="salaryCurrency"
            defaultValue={job.salaryCurrency ?? ""}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            placeholder="ETB"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Salary Period
          </label>
          <select
            name="salaryPeriod"
            defaultValue={job.salaryPeriod ?? ""}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Deadline
          </label>
          <input
            name="deadline"
            type="datetime-local"
            defaultValue={toDatetimeLocal(job.deadline)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Application URL
          </label>
          <input
            name="applicationUrl"
            type="url"
            defaultValue={job.applicationUrl ?? ""}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            placeholder="https://..."
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Responsibilities
        </label>
        <textarea
          name="responsibilities"
          rows={3}
          defaultValue={job.responsibilities ?? ""}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Requirements
        </label>
        <textarea
          name="requirements"
          rows={3}
          defaultValue={job.requirements ?? ""}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Education Requirements
        </label>
        <textarea
          name="educationRequirements"
          rows={3}
          defaultValue={job.educationRequirements ?? ""}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Benefits
        </label>
        <textarea
          name="benefits"
          rows={3}
          defaultValue={job.benefits ?? ""}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save Changes"}
        </button>
        <Link
          href={`/organization/jobs/${job.id}`}
          className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
