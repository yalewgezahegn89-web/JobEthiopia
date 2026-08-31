"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function AddMemberForm({
  organizations,
}: {
  organizations: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const organizationId = String(formData.get("organizationId") ?? "");
    const email = String(formData.get("email") ?? "").trim();

    if (!organizationId || !email) {
      setError("Please select an organization and enter an email.");
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/employer/team", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId, email }),
        });

        if (res.ok) {
          router.refresh();
          return;
        }

        let code: string | null = null;
        try {
          const data = await res.json();
          code = data?.error ?? null;
        } catch {
          code = null;
        }

        if (res.status === 409) {
          setError("That user is already a member.");
        } else if (res.status === 422) {
          setError("That user is not eligible to be added.");
        } else if (res.status === 404) {
          setError("Organization not found.");
        } else if (code === "Organization is not active") {
          setError("This organization is not active.");
        } else {
          setError("Unable to add team member.");
        }
      } catch {
        setError("Unable to add team member.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700 dark:text-gray-300">
          Organization
        </span>
        <select
          name="organizationId"
          required
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
        >
          <option value="">Select an organization</option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700 dark:text-gray-300">
          Email
        </span>
        <input
          type="email"
          name="email"
          required
          disabled={pending}
          placeholder="admin@example.com"
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
        />
      </label>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        The user must already have an active ORGANIZATION_ADMIN account.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add existing organization admin"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
