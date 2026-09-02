import Link from "next/link";

type Crumb = {
  label: string;
  href?: string;
};

export function Breadcrumb({
  items,
}: {
  items: Crumb[];
}) {
  return (
    <nav aria-label="Breadcrumb" className="py-1">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-subtle">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li
              key={`${item.label}-${index}`}
              className={isLast ? "flex min-w-0 items-center gap-1.5" : "flex items-center gap-1.5"}
            >
              {index > 0 && (
                <span aria-hidden="true" className="select-none text-subtle">
                  /
                </span>
              )}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="truncate hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className="truncate font-medium text-foreground"
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}