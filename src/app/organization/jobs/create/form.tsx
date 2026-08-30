"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
    <form onSubmit={handleSubmit} className="space-y-4">
      {organizations.length > 1 && (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Organization *
          </label>
          <select
            name="organizationId"
            required
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {organizations.length === 1 && (
        <input type="hidden" name="organizationId" value={organizations[0].id} />
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Title *
        </label>
        <input
          name="title"
          required
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
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            placeholder="UUID"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Profession ID
          </label>
          <input
            name="professionId"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            placeholder="UUID"
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
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            placeholder="UUID"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Employment Type
          </label>
          <select
            name="employmentType"
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
          {loading ? "Creating..." : "Create Job"}
        </button>
        <Link
          href="/organization/jobs"
          className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
