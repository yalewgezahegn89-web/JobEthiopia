import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/dictionary";

type Crumb = {
  label: string;
  href?: string;
};

export function Breadcrumb({
  items,
  t,
}: {
  items: Crumb[];
  t: Dictionary;
}) {
  return (
    <nav aria-label="Breadcrumb" className="py-1">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-subtle">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const label = item.href === "/" ? t.nav.home : item.label;
          return (
            <li
              key={`${label}-${index}`}
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
                  {label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className="truncate font-medium text-foreground"
                >
                  {label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}