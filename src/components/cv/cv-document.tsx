import type { CvAggregate } from "@/lib/cv/dal";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatYearMonth(value: string | null | undefined): string {
  if (!value) return "";
  const [year, month] = value.split("-");
  const m = Number(month);
  if (!year || !Number.isInteger(m) || m < 1 || m > 12) return value;
  return `${MONTHS[m - 1]} ${year}`;
}

export type CvDocumentLabels = {
  summary: string;
  experience: string;
  education: string;
  skills: string;
  certifications: string;
  phone: string;
  location: string;
  website: string;
  present: string;
};

type CvDocumentProps = {
  name: string;
  email: string | null;
  cv: CvAggregate;
  labels: CvDocumentLabels;
};

/**
 * Pure, presentational CV document (Batch 9).
 *
 * Renders the candidate's own CV for screen preview and browser print. Every
 * value is rendered as text — React escapes all output, so a candidate can
 * never inject HTML. Section rendering is deterministic (entry order is the
 * createdAt order from the DAL).
 */
export function CvDocument({ name, email, cv, labels }: CvDocumentProps) {
  const { header } = cv;
  const contact: string[] = [];
  if (header.phone) contact.push(header.phone);
  if (header.location) contact.push(header.location);

  return (
    <article
      aria-label={`Curriculum vitae of ${name}`}
      className="cv-document mx-auto w-full max-w-[820px] rounded-xl border border-border bg-surface p-10 text-foreground shadow-sm"
    >
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{name}</h1>
        {header.title ? (
          <p className="mt-1 text-xl font-semibold text-primary">
            {header.title}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted print:text-muted">
          {email ? <span>{email}</span> : null}
          {contact.length > 0 ? <span>{contact.join(" · ")}</span> : null}
          {header.websiteUrl ? (
            <a
              href={header.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2"
            >
              {header.websiteUrl}
            </a>
          ) : null}
        </div>
      </header>

      {header.professionalSummary ? (
        <section aria-label={labels.summary} className="mt-8">
          <h2 className="border-b border-border pb-1 text-xs font-bold uppercase tracking-widest text-muted">
            {labels.summary}
          </h2>
          <p className="mt-3 text-base leading-7">{header.professionalSummary}</p>
        </section>
      ) : null}

      {cv.experiences.length > 0 ? (
        <section aria-label={labels.experience} className="mt-8">
          <h2 className="border-b border-border pb-1 text-xs font-bold uppercase tracking-widest text-muted">
            {labels.experience}
          </h2>
          <ol className="mt-4 space-y-6">
            {cv.experiences.map((entry) => (
              <li key={entry.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="text-base font-semibold">{entry.role}</h3>
                  <p className="text-sm text-muted">
                    {formatYearMonth(entry.startMonth)}
                    {" – "}
                    {entry.endMonth
                      ? formatYearMonth(entry.endMonth)
                      : labels.present}
                  </p>
                </div>
                <p className="text-sm font-medium text-primary">{entry.employer}</p>
                {entry.location ? (
                  <p className="text-sm text-muted">{entry.location}</p>
                ) : null}
                {entry.description ? (
                  <p className="mt-2 text-sm leading-6">{entry.description}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {cv.educations.length > 0 ? (
        <section aria-label={labels.education} className="mt-8">
          <h2 className="border-b border-border pb-1 text-xs font-bold uppercase tracking-widest text-muted">
            {labels.education}
          </h2>
          <ol className="mt-4 space-y-5">
            {cv.educations.map((entry) => (
              <li key={entry.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="text-base font-semibold">{entry.qualification}</h3>
                  <p className="text-sm text-muted">
                    {formatYearMonth(entry.startMonth)}
                    {" – "}
                    {entry.endMonth
                      ? formatYearMonth(entry.endMonth)
                      : labels.present}
                  </p>
                </div>
                <p className="text-sm font-medium text-primary">
                  {entry.institution}
                </p>
                {entry.fieldOfStudy ? (
                  <p className="text-sm text-muted">{entry.fieldOfStudy}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {cv.skills.length > 0 ? (
        <section aria-label={labels.skills} className="mt-8">
          <h2 className="border-b border-border pb-1 text-xs font-bold uppercase tracking-widest text-muted">
            {labels.skills}
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {cv.skills.map((skill) => (
              <li
                key={skill.id}
                className="rounded-full bg-primary-light px-3 py-1 text-sm text-primary"
              >
                {skill.name}
                {skill.level ? ` — ${skill.level}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {cv.certifications.length > 0 ? (
        <section aria-label={labels.certifications} className="mt-8">
          <h2 className="border-b border-border pb-1 text-xs font-bold uppercase tracking-widest text-muted">
            {labels.certifications}
          </h2>
          <ul className="mt-4 space-y-4">
            {cv.certifications.map((cert) => (
              <li key={cert.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="text-sm font-semibold">{cert.name}</h3>
                  <p className="text-sm text-muted">
                    {formatYearMonth(cert.issuedMonth)}
                  </p>
                </div>
                <p className="text-sm text-muted">{cert.issuer}</p>
                {cert.credentialUrl ? (
                  <a
                    href={cert.credentialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-block text-sm text-primary underline underline-offset-2"
                  >
                    {cert.credentialUrl}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}