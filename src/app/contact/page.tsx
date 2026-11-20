import type { Metadata } from "next";
import { getI18n, getCurrentLocale } from "@/lib/i18n/server";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getI18n(), getCurrentLocale()]);
  return buildPageMetadata({
    path: "/contact",
    locale,
    title: t.seo.contact.title,
    description: t.seo.contact.description,
    includeAlternates: true,
    includeXDefault: true,
  });
}

export default async function ContactPage() {
  const t = await getI18n();
  const email = t.contact.emailAddress;
  const mailto = `mailto:${email}`;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        {t.contact.heading}
      </h1>
      <p className="mt-4 text-foreground">{t.contact.intro}</p>

      <section className="mt-8 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          {t.contact.emailLabel}
        </h2>
        <p className="mt-2">
          <a
            href={mailto}
            className="break-all text-lg font-semibold text-primary underline transition-colors duration-150 hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {email}
          </a>
        </p>
        <p className="mt-4 text-sm text-muted">{t.contact.responseNote}</p>
        <a
          href={mailto}
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t.contact.cta}
        </a>
      </section>
    </main>
  );
}
