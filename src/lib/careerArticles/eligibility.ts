/**
 * Single source of truth for public career-article eligibility.
 *
 * A career article is publicly eligible only when it has been published and
 * its publication instant is at or before the current server time. The same
 * predicate is used by the public API, the detail page's metadata, and the
 * detail page itself so that a scheduled or undated article can never be
 * served, indexed, or given Article structured data ahead of its time.
 */

export type ArticleEligibilityFields = {
  status: string | null | undefined;
  /** Exact publication instant when available; a parseable date is also fine. */
  publishedAt: string | number | Date | null | undefined;
};

export function isArticlePubliclyEligible(
  article: ArticleEligibilityFields,
  now: Date = new Date(),
): boolean {
  if (article.status !== "PUBLISHED") return false;
  if (article.publishedAt == null) return false;

  const published =
    article.publishedAt instanceof Date
      ? article.publishedAt
      : new Date(article.publishedAt);

  if (Number.isNaN(published.getTime())) return false;

  return published.getTime() <= now.getTime();
}
