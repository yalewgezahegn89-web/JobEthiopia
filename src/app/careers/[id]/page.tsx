import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fetchCareerArticle,
  type PublicArticleDetail,
} from "@/lib/careerArticles/public";

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
              <span className="rounded-md bg-gray-100 px-2 py-1 dark:bg-gray-800">
                {article.category}
              </span>
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
      </article>
    </div>
  );
}