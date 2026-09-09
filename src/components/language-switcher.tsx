"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { LOCALE_METADATA, LOCALES } from "@/lib/i18n/locale";
import { localizePath } from "@/lib/i18n/routing";

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function LanguageSwitcher() {
  const pathname = usePathname();
  const { locale } = useI18n();
  const t = useI18n().t;

  return (
    <nav
      aria-label={t.language.label}
      className="flex items-center gap-1 rounded-full border border-border bg-surface px-1.5 py-1"
    >
      {LOCALES.map((code) => {
        const isCurrent = code === locale;
        const meta = LOCALE_METADATA[code];
        const href = localizePath(pathname, code);
        return (
          <Link
            key={code}
            href={href}
            aria-current={isCurrent ? "true" : undefined}
            aria-label={`${meta.name} (${code})`}
            title={t.language.switchTo(code, meta.name)}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors duration-150 ${focusRing} ${
              isCurrent
                ? "bg-primary text-white"
                : "text-muted hover:bg-surface-raised hover:text-foreground"
            }`}
          >
            {meta.name}
          </Link>
        );
      })}
    </nav>
  );
}
