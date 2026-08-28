import type { PublicArticleSummary } from "./public";

export function selectRelatedArticles(
  items: PublicArticleSummary[],
  currentId: string,
  category: string | null,
  count = 3,
): PublicArticleSummary[] {
  if (category === null || count <= 0) {
    return [];
  }

  return items
    .filter(
      (article) => article.id !== currentId && article.category === category,
    )
    .slice(0, count);
}