import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fetchCareerArticle,
  fetchCareerArticles,
  type PublicArticleDetail,
  type PublicArticleSummary,
} from "@/lib/careerArticles/public";
import { selectRelatedArticles } from "@/lib/careerArticles/related";
import { Breadcrumb } from "@/components/public/breadcrumb";
import { BookIcon, CalendarIcon, ArrowRightIcon } from "@/components/public/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Career Resource | JobEthiopia",
  description: "Career advice and resources on JobEthiopia.",
};

export default async function CareerArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let article: PublicArticleDetail | null = null;
  let loadError = false;

  try {
    article = await fetchCareerArticle(id);
  } catch {
    loadError = true;
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Career resource</h1>
        <p className="mt-4 text-muted">
          We could not load this article right now. Please try again shortly.
        </p>
        <Link
          href="/careers"
          className="focus-visible:outline-2 mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Back to Career Resources
        </Link>
      </div>
    );
  }

  if (!article) {
    notFound();
  }

  let related: PublicArticleSummary[] = [];
  const category = article.category;
  if (category) {
    try {
      const result = await fetchCareerArticles({
        category,
        page: 1,
        limit: 8,
      });
      related = selectRelatedArticles(result.items, article.id, category, 3);
    } catch {
      related = [];
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-10">
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Career resources", href: "/careers" },
          { label: article.title },
        ]}
      />

      <article className="mt-6">
        <header>
          {article.category && (
            <Link
              href={`/careers?category=${encodeURIComponent(article.category)}`}
              className="focus-visible:outline-2 inline-flex items-center gap-1.5 rounded-full bg-accent-light px-3 py-1 text-xs font-semibold text-warning hover:bg-accent-light/70 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <BookIcon className="h-3.5 w-3.5" />
              {article.category}
            </Link>
          )}
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {article.title}
          </h1>
          {article.publishedAt && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-subtle">
              <CalendarIcon className="h-4 w-4" />
              Published {article.publishedAt}
            </p>
          )}
        </header>

        <div className="mt-6 text-base leading-7 text-foreground">
          {article.excerpt && (
            <p className="border-l-4 border-accent bg-accent-light/40 pl-4 italic text-muted">
              {article.excerpt}
            </p>
          )}

          {article.content && (
            <div className="mt-6">
              <p className="whitespace-pre-line">{article.content}</p>
            </div>
          )}
        </div>
      </article>

      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="mt-10 border-t border-border pt-8">
          <h2
            id="related-heading"
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            More in {category}
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {related.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/careers/${item.id}`}
                  className="group block h-full rounded-xl border border-border bg-surface p-4 shadow-sm transition-all duration-200 hover:border-primary/20 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <h3 className="text-sm font-semibold leading-snug text-foreground group-hover:text-primary">
                    {item.title}
                  </h3>
                  {item.publishedAt && (
                    <p className="mt-1 text-xs text-subtle">
                      Published {item.publishedAt}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link
        href="/careers"
        className="focus-visible:outline-2 mt-10 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-6 py-3 text-base font-semibold text-foreground transition-colors hover:bg-surface-raised focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto"
      >
        Browse all career resources
        <ArrowRightIcon className="h-4 w-4" />
      </Link>
    </div>
  );
}