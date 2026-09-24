import type { CoverLetterRow } from "@/lib/coverLetter/dal";

export type CoverLetterDocumentLabels = {
  re: string;
  dear: string;
  dearFallback: string;
  signoff: string;
};

type CoverLetterDocumentProps = {
  letter: CoverLetterRow;
  name: string;
  email: string | null;
  date: string;
  contact: {
    phone: string | null;
    location: string | null;
  } | null;
  labels: CoverLetterDocumentLabels;
};

/**
 * Pure, presentational cover-letter document (Phase 13 — Career Tools).
 *
 * Renders the candidate's own letter for screen preview and browser print.
 * Every value renders as text — React escapes all output, so letter content
 * can never inject HTML. No CSS classes are interpolated from content.
 */
export function CoverLetterDocument({
  letter,
  name,
  email,
  date,
  contact,
  labels,
}: CoverLetterDocumentProps) {
  const contactParts: string[] = [];
  if (email) contactParts.push(email);
  if (contact?.phone) contactParts.push(contact.phone);
  if (letter.location ?? contact?.location) {
    contactParts.push(letter.location ?? (contact?.location as string));
  }

  const salutation = letter.recipient
    ? `${labels.dear} ${letter.recipient},`
    : labels.dearFallback;

  return (
    <article
      aria-label={letter.title}
      className="cover-letter-document mx-auto w-full max-w-[820px] rounded-xl border border-border bg-surface p-10 text-foreground shadow-sm"
    >
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
        {contactParts.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted print:text-muted">
            {contactParts.map((part, index) => (
              <span key={`${part}-${index}`}>{part}</span>
            ))}
          </div>
        ) : null}
      </header>

      <p className="mt-8 text-base">{date}</p>

      <section className="mt-8">
        <h2 className="text-base font-semibold">{labels.re} {letter.position}</h2>
        <p className="mt-1 text-sm text-muted">
          {letter.employer}
          {letter.location ? ` — ${letter.location}` : ""}
        </p>
      </section>

      <p className="mt-6 text-base leading-7">{salutation}</p>

      <div className="mt-4 space-y-4 whitespace-pre-line text-base leading-7">
        {letter.body}
      </div>

      <footer className="mt-10">
        <p className="text-base">{labels.signoff}</p>
        <p className="mt-1 text-base font-semibold">{name}</p>
      </footer>
    </article>
  );
}