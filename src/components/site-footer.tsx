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
  const facebookLabel =
    locale === "am"
      ? "የፌስቡክ ገጻችንን ይከተሉ"
      : locale === "om"
        ? "Fuula Facebook keenyaa hordofi"
        : "Follow JobEthiopia on Facebook";

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
                href="https://www.facebook.com/JobEthiopiaET"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={facebookLabel}
                className="inline-flex items-center gap-1.5 font-semibold text-primary transition-colors duration-150 hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-4 w-4 fill-current"
                >
                  <path d="M22 12.06C22 6.504 17.523 2 12 2S2 6.504 2 12.06C2 17.083 5.656 21.245 10.438 22v-7.03H7.898v-2.91h2.54V9.845c0-2.522 1.492-3.915 3.777-3.915 1.094 0 2.238.197 2.238.197v2.476h-1.26c-1.243 0-1.63.776-1.63 1.572v1.885h2.773l-.443 2.91h-2.33V22C18.344 21.245 22 17.083 22 12.06Z" />
                </svg>
                {facebookLabel}
              </a>
            </li>
            <li>
              <a
                href="https://t.me/jobethiopiaet"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={telegramLabel}
                className="inline-flex items-center gap-1.5 font-semibold text-primary transition-colors duration-150 hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-4 w-4 fill-current"
                >
                  <path d="M21.944 4.507a1.5 1.5 0 0 0-1.52-.232L2.77 11.145a1.5 1.5 0 0 0 .076 2.805l4.61 1.537 1.785 5.534a1.5 1.5 0 0 0 2.57.533l2.457-2.921 4.534 3.34a1.5 1.5 0 0 0 2.353-.91l2.186-15.305a1.5 1.5 0 0 0-.397-1.251ZM9.295 14.3l8.86-5.463-7.12 6.583-.39 3.31-1.35-4.43Zm2.38 4.853.244-2.07 1.19.877-1.434 1.193Zm7.02.15-5.54-4.08 6.68-6.176-1.14 10.256Z" />
                </svg>
                {telegramLabel}
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
