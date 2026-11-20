import type { LegalDocument, LegalSection } from "@/lib/legal/content";

/**
 * Shared server renderer for the legal documents. The content itself is
 * translated for all supported locales; this component only handles layout.
 */
export default function LegalDocumentView({
  document,
}: {
  document: LegalDocument;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <article>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {document.heading}
        </h1>
        <div className="mt-6 space-y-4 text-foreground">
          {document.intro.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        {document.sections.map((section) => (
          <LegalSectionView key={section.heading} section={section} />
        ))}
      </article>
    </main>
  );
}

function LegalSectionView({ section }: { section: LegalSection }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold text-foreground">
        {section.heading}
      </h2>
      <div className="mt-3 space-y-4 text-foreground">
        {section.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      {section.bullets && section.bullets.length > 0 ? (
        <ul className="mt-4 list-disc space-y-2 pl-6 text-foreground">
          {section.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      ) : null}
      {section.links && section.links.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-primary underline underline-offset-2">
          {section.links.map((link) => {
            const external = link.href.startsWith("http");
            return (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="font-semibold hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  {...(external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                >
                  {link.label}
                </a>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
