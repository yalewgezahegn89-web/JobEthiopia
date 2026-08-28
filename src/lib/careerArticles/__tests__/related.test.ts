import { describe, it, expect } from "vitest";
import { selectRelatedArticles } from "../related";
import type { PublicArticleSummary } from "../public";

function makeArticle(
  overrides: Partial<PublicArticleSummary> = {},
): PublicArticleSummary {
  return {
    id: "123e4567-e89b-12d3-a456-426614174000",
    title: "How to Ace an Interview",
    slug: "how-to-ace-an-interview",
    category: "Career Advice",
    excerpt: "Practical tips for interviews.",
    publishedAt: "Feb 10, 2026",
    ...overrides,
  };
}

const currentArticle = makeArticle();
const sameCategoryA = makeArticle({
  id: "123e4567-e89b-12d3-a456-426614174001",
  title: "Resume Basics",
  slug: "resume-basics",
});
const sameCategoryB = makeArticle({
  id: "123e4567-e89b-12d3-a456-426614174002",
  title: "Salary Negotiation",
  slug: "salary-negotiation",
});
const sameCategoryC = makeArticle({
  id: "123e4567-e89b-12d3-a456-426614174003",
  title: "Networking 101",
  slug: "networking-101",
});
const otherCategory = makeArticle({
  id: "123e4567-e89b-12d3-a456-426614174004",
  category: "CV Writing",
  title: "Design a Strong CV",
  slug: "design-a-strong-cv",
});

describe("selectRelatedArticles", () => {
  it("returns matching same-category articles", () => {
    const result = selectRelatedArticles(
      [currentArticle, sameCategoryA, otherCategory],
      currentArticle.id,
      "Career Advice",
    );

    expect(result.map((item) => item.id)).toEqual([sameCategoryA.id]);
  });

  it("excludes the current article", () => {
    const result = selectRelatedArticles(
      [currentArticle, sameCategoryA],
      currentArticle.id,
      "Career Advice",
    );

    expect(result.map((item) => item.id)).not.toContain(currentArticle.id);
  });

  it("preserves the original API ordering", () => {
    const items = [sameCategoryC, sameCategoryA, sameCategoryB];
    const result = selectRelatedArticles(
      items,
      currentArticle.id,
      "Career Advice",
      3,
    );

    expect(result.map((item) => item.id)).toEqual([
      sameCategoryC.id,
      sameCategoryA.id,
      sameCategoryB.id,
    ]);
  });

  it("limits results to the default count of 3", () => {
    const items = [currentArticle, sameCategoryA, sameCategoryB, sameCategoryC];
    const result = selectRelatedArticles(
      items,
      currentArticle.id,
      "Career Advice",
    );

    expect(result).toHaveLength(3);
    expect(result.map((item) => item.id)).toEqual([
      sameCategoryA.id,
      sameCategoryB.id,
      sameCategoryC.id,
    ]);
  });

  it("respects an explicit count", () => {
    const items = [sameCategoryA, sameCategoryB, sameCategoryC];
    const result = selectRelatedArticles(
      items,
      currentArticle.id,
      "Career Advice",
      2,
    );

    expect(result).toHaveLength(2);
  });

  it("returns an empty array when count is 0", () => {
    const result = selectRelatedArticles(
      [sameCategoryA],
      currentArticle.id,
      "Career Advice",
      0,
    );

    expect(result).toEqual([]);
  });

  it("returns an empty array for a negative count", () => {
    const result = selectRelatedArticles(
      [sameCategoryA],
      currentArticle.id,
      "Career Advice",
      -1,
    );

    expect(result).toEqual([]);
  });

  it("returns an empty array when category is null", () => {
    const result = selectRelatedArticles(
      [sameCategoryA],
      currentArticle.id,
      null,
    );

    expect(result).toEqual([]);
  });

  it("returns an empty array for empty input", () => {
    const result = selectRelatedArticles([], currentArticle.id, "Career Advice");

    expect(result).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const items = [currentArticle, sameCategoryA, otherCategory];
    const snapshot = items.map((item) => item.id);

    selectRelatedArticles(items, currentArticle.id, "Career Advice", 2);

    expect(items.map((item) => item.id)).toEqual(snapshot);
  });

  it("excludes articles from other categories", () => {
    const result = selectRelatedArticles(
      [sameCategoryA, otherCategory],
      currentArticle.id,
      "Career Advice",
    );

    expect(result.map((item) => item.id)).toEqual([sameCategoryA.id]);
  });

  it("excludes the current article even when its category matches", () => {
    const result = selectRelatedArticles(
      [currentArticle, sameCategoryA],
      currentArticle.id,
      currentArticle.category ?? "",
    );

    expect(result.map((item) => item.id)).toEqual([sameCategoryA.id]);
  });

  it("returns all available matching articles when fewer than requested", () => {
    const result = selectRelatedArticles(
      [currentArticle, sameCategoryA],
      currentArticle.id,
      "Career Advice",
      5,
    );

    expect(result).toHaveLength(1);
    expect(result.map((item) => item.id)).toEqual([sameCategoryA.id]);
  });
});