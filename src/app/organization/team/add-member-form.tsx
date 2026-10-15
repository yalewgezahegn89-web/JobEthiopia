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

const selectClass =
  "mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const labelClass = "block text-sm font-medium text-foreground";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className={labelClass}>
        Organization
        <select
          name="organizationId"
          required
          disabled={pending}
          className={selectClass}
        >
          <option value="">Select an organization</option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </label>

      <label className={labelClass}>
        Email
        <input
          type="email"
          name="email"
          required
          disabled={pending}
          placeholder="admin@example.com"
          className={selectClass}
        />
      </label>

      <p className="text-xs text-muted">
        The user must already have an active ORGANIZATION_ADMIN account.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add existing organization admin"}
      </button>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
