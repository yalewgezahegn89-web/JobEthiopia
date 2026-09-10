"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n/locale";

const FREQUENCIES = ["INSTANT", "DAILY"] as const;

type JobAlertFormProps = {
  categories: { id: string; name: string }[];
  professions: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  locale: Locale;
};

export function JobAlertForm({
  categories,
  professions,
  locations,
  locale,
}: JobAlertFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [professionId, setProfessionId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [frequency, setFrequency] = useState<string>("DAILY");

  const labels =
    locale === "am"
      ? {
          heading: "አዲስ ማሳወቂያ ይፍጠሩ",
          nameLabel: "ማሳወቂያ ስም",
          namePlaceholder: "ለምሳሌ በአዲስ አበባ አודיተር",
          keywordsLabel: "ቁልፍ ቃላት",
          keywordsPlaceholder: "ለምሳሌ አודיተር፣ Excel፣ IFRS",
          keywordsHint: "ቁልፍ ቃላትን በካማ ወይም በክፍል ምልክት ያልዩ።",
          categoryLabel: "ምድብ",
          professionLabel: "ሙያ",
          locationLabel: "አካባቢ",
          employmentTypeLabel: "የስራ ዓይነት",
          frequencyLabel: "ድግግሞሽ",
          anyCategory: "ማንኛውም ምድብ",
          anyProfession: "ማንኛውም ሙያ",
          anyLocation: "ማንኛውም አካባቢ",
          anyEmploymentType: "ማንኛውም ዓይነት",
          frequencyInstant: "ሲመጣ ወዲያውኑ",
          frequencyDaily: "ዕለታዊ ማጠቃለያ",
          submitCreate: "ማሳወቂያ ይፍጠሩ",
          submitting: "በመፍጠር ላይ…",
          createFailed: "ማሳወቂያ መፍጠር አልተቻለም። እባክዎ እንደገና ይሞክሩ።",
        }
      : locale === "om"
        ? {
            heading: "Beeksiisa haaraa uumi",
            nameLabel: "Maqaa beeksiisa",
            namePlaceholder: "akka jecha Addis Ababa ogummaa",
            keywordsLabel: "Jecha gurguddoo",
            keywordsPlaceholder: "akka jecha ogummaa, Excel, IFRS",
            keywordsHint: "Jecha gurguddoo tuqaa yookaan cufii ilaali.",
            categoryLabel: "Ramaddii",
            professionLabel: "Ogummaa",
            locationLabel: "Iddoo",
            employmentTypeLabel: "Agaanii hojii",
            frequencyLabel: "Yeroo",
            anyCategory: "Ramaddii kamiyyuu",
            anyProfession: "Ogummaa kamiyyuu",
            anyLocation: "Iddoo kamiyyuu",
            anyEmploymentType: "Agaanii kamiyyuu",
            frequencyInstant: "Baasu keessaatti",
            frequencyDaily: "Guyyaa ta'u",
            submitCreate: "Beeksiisa uumi",
            submitting: "Aja'ee jira…",
            createFailed: "Beeksiisa uumuu hin dandeenye. Mee itti deebii yaali.",
          }
        : {
            heading: "Create a job alert",
            nameLabel: "Alert name",
            namePlaceholder: "e.g. Accountant in Addis Ababa",
            keywordsLabel: "Keywords",
            keywordsPlaceholder: "e.g. accountant, Excel, IFRS",
            keywordsHint: "Separate keywords with commas or spaces.",
            categoryLabel: "Category",
            professionLabel: "Profession",
            locationLabel: "Location",
            employmentTypeLabel: "Employment type",
            frequencyLabel: "Frequency",
            anyCategory: "Any category",
            anyProfession: "Any profession",
            anyLocation: "Any location",
            anyEmploymentType: "Any employment type",
            frequencyInstant: "As soon as a job matches",
            frequencyDaily: "A daily digest",
            submitCreate: "Create alert",
            submitting: "Creating…",
            createFailed:
              "We could not create this alert. Please try again.",
          };

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await fetch("/api/job-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          keywords: keywords.trim() || undefined,
          categoryId: categoryId || undefined,
          professionId: professionId || undefined,
          locationId: locationId || undefined,
          employmentType: employmentType || undefined,
          frequency,
          locale,
        }),
      });
      if (res.status === 201) {
        setName("");
        setKeywords("");
        setCategoryId("");
        setProfessionId("");
        setLocationId("");
        setEmploymentType("");
        setFrequency("DAILY");
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(body?.error ?? labels.createFailed);
    });
  }

  return (
    <section className="mt-8 rounded-xl border border-border bg-surface-raised p-6">
      <h2 className="text-lg font-bold text-foreground">{labels.heading}</h2>

      <form onSubmit={submit} className="mt-4 space-y-5">
        <div>
          <label
            htmlFor="alert-name"
            className="mb-1 block text-sm font-semibold text-foreground"
          >
            {labels.nameLabel}
          </label>
          <input
            id="alert-name"
            type="text"
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={labels.namePlaceholder}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div>
          <label
            htmlFor="alert-keywords"
            className="mb-1 block text-sm font-semibold text-foreground"
          >
            {labels.keywordsLabel}
          </label>
          <input
            id="alert-keywords"
            type="text"
            maxLength={200}
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder={labels.keywordsPlaceholder}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <p className="mt-1 text-xs text-subtle">{labels.keywordsHint}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="alert-category"
              className="mb-1 block text-sm font-semibold text-foreground"
            >
              {labels.categoryLabel}
            </label>
            <select
              id="alert-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">{labels.anyCategory}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="alert-profession"
              className="mb-1 block text-sm font-semibold text-foreground"
            >
              {labels.professionLabel}
            </label>
            <select
              id="alert-profession"
              value={professionId}
              onChange={(e) => setProfessionId(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">{labels.anyProfession}</option>
              {professions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="alert-location"
              className="mb-1 block text-sm font-semibold text-foreground"
            >
              {labels.locationLabel}
            </label>
            <select
              id="alert-location"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">{labels.anyLocation}</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="alert-employment"
              className="mb-1 block text-sm font-semibold text-foreground"
            >
              {labels.employmentTypeLabel}
            </label>
            <select
              id="alert-employment"
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">{labels.anyEmploymentType}</option>
              <option value="FULL_TIME">Full-time</option>
              <option value="PART_TIME">Part-time</option>
              <option value="CONTRACT">Contract</option>
              <option value="INTERNSHIP">Internship</option>
              <option value="TEMPORARY">Temporary</option>
            </select>
          </div>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-foreground">
            {labels.frequencyLabel}
          </legend>
          <div className="flex flex-wrap gap-3">
            {FREQUENCIES.map((freq) => (
              <label
                key={freq}
                className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                  frequency === freq
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-surface text-muted hover:border-primary/50"
                }`}
              >
                <input
                  type="radio"
                  name="frequency"
                  value={freq}
                  checked={frequency === freq}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="sr-only"
                />
                {freq === "INSTANT" ? labels.frequencyInstant : labels.frequencyDaily}
              </label>
            ))}
          </div>
        </fieldset>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? labels.submitting : labels.submitCreate}
        </button>
      </form>
    </section>
  );
}