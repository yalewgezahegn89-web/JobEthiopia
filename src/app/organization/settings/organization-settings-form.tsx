"use client";

import { useState, useTransition } from "react";

type Organization = {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  websiteUrl: string | null;
};

type Props = {
  organization: Organization;
  t: {
    nameLabel: string;
    descriptionLabel: string;
    industryLabel: string;
    websiteLabel: string;
    save: string;
    saving: string;
    success: string;
    error: string;
  };
};

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function OrganizationSettingsForm({ organization, t }: Props) {
  const [name, setName] = useState(organization.name);
  const [description, setDescription] = useState(organization.description ?? "");
  const [industry, setIndustry] = useState(organization.industry ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(organization.websiteUrl ?? "");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/employer/organization`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: organization.id,
            name: name.trim(),
            description: description.trim() || null,
            industry: industry.trim() || null,
            websiteUrl: websiteUrl.trim() || null,
          }),
        });

        if (res.ok) {
          setMessage({ type: "success", text: t.success });
        } else {
          setMessage({ type: "error", text: t.error });
        }
      } catch {
        setMessage({ type: "error", text: t.error });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {message && (
        <div
          role="alert"
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            message.type === "success"
              ? "bg-success-light text-success"
              : "bg-destructive-light text-destructive"
          }`}
        >
          {message.text}
        </div>
      )}

      <div>
        <label
          htmlFor="name"
          className="block text-sm font-semibold text-foreground"
        >
          {t.nameLabel}
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className={`mt-1.5 block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted focus:border-primary focus:ring-1 focus:ring-primary ${focusRing}`}
        />
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-semibold text-foreground"
        >
          {t.descriptionLabel}
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className={`mt-1.5 block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted focus:border-primary focus:ring-1 focus:ring-primary ${focusRing}`}
        />
      </div>

      <div>
        <label
          htmlFor="industry"
          className="block text-sm font-semibold text-foreground"
        >
          {t.industryLabel}
        </label>
        <input
          id="industry"
          type="text"
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          className={`mt-1.5 block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted focus:border-primary focus:ring-1 focus:ring-primary ${focusRing}`}
        />
      </div>

      <div>
        <label
          htmlFor="websiteUrl"
          className="block text-sm font-semibold text-foreground"
        >
          {t.websiteLabel}
        </label>
        <input
          id="websiteUrl"
          type="url"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          placeholder="https://..."
          className={`mt-1.5 block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted focus:border-primary focus:ring-1 focus:ring-primary ${focusRing}`}
        />
      </div>

      <div>
        <button
          type="submit"
          disabled={isPending}
          className={`inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 ${focusRing}`}
        >
          {isPending ? t.saving : t.save}
        </button>
      </div>
    </form>
  );
}
