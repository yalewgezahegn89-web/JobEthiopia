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
      <div className="mx-auto w-full max-w-3xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold">Career resource</h1>
        <p className="mt-4 text-gray-600 dark:text-gray-300">
          We could not load this article right now. Please try again shortly.
        </p>
        <Link
          href="/careers"
          className="mt-6 inline-block font-semibold text-blue-600 underline dark:text-blue-400"
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
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link
        href="/careers"
        className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
      >
        &larr; Back to Career Resources
      </Link>

      <article className="mt-4">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">{article.title}</h1>

          <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-300">
            {article.category && (
              <Link
                href={`/careers?category=${encodeURIComponent(article.category)}`}
                className="rounded-md bg-gray-100 px-2 py-1 hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:bg-gray-800 dark:hover:bg-gray-700"
              >
                {article.category}
              </Link>
            )}
            {article.publishedAt && (
              <span className="rounded-md bg-gray-100 px-2 py-1 dark:bg-gray-800">
                Published {article.publishedAt}
              </span>
            )}
          </div>
        </header>

        <div className="mt-6 text-sm leading-7 text-gray-700 dark:text-gray-200">
          {article.excerpt && (
            <p className="border-l-4 border-gray-200 pl-4 italic text-gray-600 dark:border-gray-800 dark:text-gray-300">
              {article.excerpt}
            </p>
          )}

          {article.content && (
            <div className="mt-6">
              <p className="whitespace-pre-line">{article.content}</p>
            </div>
          )}
        </div>

        {related.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
              More in {category}
            </h2>
            <ul className="mt-3 space-y-3">
              {related.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/careers/${item.id}`}
                    className="block rounded-lg border border-gray-200 p-4 transition-colors hover:border-blue-400 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
                  >
                    <h3 className="font-semibold text-blue-700 dark:text-blue-400">
                      {item.title}
                    </h3>
                    {item.publishedAt && (
                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                        Published {item.publishedAt}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>

      <Link
        href="/careers"
        className="mt-8 inline-flex w-full items-center justify-center rounded-md border border-gray-300 px-6 py-3 text-base font-semibold text-gray-900 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800 sm:w-auto"
      >
        Browse all career resources
      </Link>
    </div>
  );
}