export function EmptyState({
  icon,
  heading,
  body,
  ctaHref,
  ctaLabel,
}: {
  icon: React.ReactNode;
  heading: string;
  body: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div
      className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center"
      role="status"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-raised text-primary">
        {icon}
      </span>
      <h2 className="mt-5 text-xl font-bold text-foreground">{heading}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted">{body}</p>
      {ctaHref && ctaLabel && (
        <a
          href={ctaHref}
          className="focus-visible:outline-2 mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {ctaLabel}
        </a>
      )}
    </div>
  );
}