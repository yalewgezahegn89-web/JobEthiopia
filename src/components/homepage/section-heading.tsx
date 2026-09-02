type SectionHeadingProps = {
  id?: string;
  eyebrow?: React.ReactNode;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  action?: React.ReactNode;
};

export function SectionHeading({
  id,
  eyebrow,
  title,
  subtitle,
  align = "left",
  action,
}: SectionHeadingProps) {
  return (
    <div
      className={`flex flex-wrap items-end justify-between gap-4 ${
        align === "center" ? "text-center" : ""
      }`}
    >
      <div className={align === "center" ? "mx-auto" : ""}>
        {eyebrow && (
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
            {eyebrow}
          </p>
        )}
        <h2
          id={id}
          className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
        >
          {title}
        </h2>
        {subtitle && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted sm:text-base">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
