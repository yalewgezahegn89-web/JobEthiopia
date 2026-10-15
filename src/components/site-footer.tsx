import Link from "next/link";
import { getCurrentLocale, getI18n } from "@/lib/i18n/server";

export default async function SiteFooter() {
  const year = new Date().getFullYear();
  const [t, locale] = await Promise.all([getI18n(), getCurrentLocale()]);

  const telegramLabel =
    locale === "am"
      ? "የቴሌግራም ቻናላችንን ይቀላቀሉ"
      : locale === "om"
        ? "Chaanaalii Telegram keenyaa hordofi"
        : "Join our Telegram channel";

  const footerLinks = [
    { href: "/", label: t.nav.home },
    { href: "/jobs", label: t.nav.jobs },
    { href: "/organizations", label: t.nav.organizations },
    { href: "/categories", label: t.nav.categories },
    { href: "/professions", label: t.nav.professions },
    { href: "/locations", label: t.nav.locations },
    { href: "/careers", label: t.nav.careers },
  ];

  return (
    <footer className="border-t border-border-subtle bg-surface">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-4 px-4 py-8 text-sm text-muted sm:px-6 lg:px-8">
        <p>&copy; {year} {t.common.brand}</p>
        <nav aria-label={t.footer.footerNavLabel}>
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {footerLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="font-medium text-muted transition-colors duration-150 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <a
                href="https://t.me/jobethiopiaet"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-primary transition-colors duration-150 hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {telegramLabel}
                <span aria-hidden="true">↗</span>
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
