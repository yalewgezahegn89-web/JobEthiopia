type TrustSignal = {
  title: string;
  description: string;
  icon: "verified" | "precise" | "curated";
};

const SIGNALS: TrustSignal[] = [
  {
    title: "Verified listings",
    description:
      "Every published role is reviewed for authenticity before it reaches you.",
    icon: "verified",
  },
  {
    title: "Precise search",
    description:
      "Filter by profession, category, and location to find roles that fit you.",
    icon: "precise",
  },
  {
    title: "Curated opportunities",
    description:
      "Fresh, relevant openings surfaced from across Ethiopia's job market.",
    icon: "curated",
  },
];

const ICONS: Record<TrustSignal["icon"], React.ReactNode> = {
  verified: (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  precise: (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
      <path d="M11 8v6M8 11h6" />
    </svg>
  ),
  curated: (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 9h1M14 9h1M9 13h1M14 13h1M9 17h1M14 17h1" />
    </svg>
  ),
};

export function TrustSignals() {
  return (
    <section
      aria-label="Why choose JobEthiopia"
      className="border-y border-border-subtle bg-surface"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:py-12">
        <ul className="grid gap-8 sm:gap-10 md:grid-cols-3">
          {SIGNALS.map((signal) => (
            <li key={signal.title} className="flex gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
                {ICONS[signal.icon]}
              </span>
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  {signal.title}
                </h3>
                <p className="mt-1.5 text-sm leading-6 text-muted">
                  {signal.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
