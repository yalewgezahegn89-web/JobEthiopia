import Link from "next/link";
import type { PublicArticleSummary } from "@/lib/careerArticles/public";
import { SectionHeading } from "@/components/homepage/section-heading";

export function CareerResources({
  articles,
}: {
  articles: PublicArticleSummary[];
}) {
  return (
    <section aria-labelledby="resources-heading">
      <SectionHeading
        id="resources-heading"
        eyebrow="Career resources"
        title="Grow your career"
        subtitle="Practical guidance and insights to help you move forward in your career."
        action={
          <Link
            href="/careers"
            className="focus-visible:outline-2 text-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            View all resources
          </Link>
        }
      />

      <div className="mt-8 space-y-4">
        {articles.map((article) => (
          <article
            key={article.id}
            className="rounded-xl border border-border-subtle bg-surface-raised p-6 transition-all duration-200 hover:border-primary/30 hover:bg-surface hover:shadow-sm"
          >
            <Link
              href={`/careers/${article.id}`}
              className="focus-visible:outline-2 group block focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <div className="flex flex-wrap items-center gap-2">
                {article.category && (
                  <span className="rounded-full bg-accent-light px-3 py-1 text-xs font-semibold text-warning">
                    {article.category}
                  </span>
                )}
                {article.publishedAt && (
                  <span className="text-xs text-subtle">
                    {article.publishedAt}
                  </span>
                )}
              </div>
              <h3 className="mt-3 text-xl font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
                {article.title}
              </h3>
              {article.excerpt && (
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">
                  {article.excerpt}
                </p>
              )}
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                Read article
                <svg
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </span>
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
