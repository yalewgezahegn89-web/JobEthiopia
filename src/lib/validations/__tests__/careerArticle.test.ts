import { describe, it, expect } from "vitest";
import {
  createCareerArticleSchema,
  updateCareerArticleSchema,
  CAREER_ARTICLE_TITLE_MAX,
  CAREER_ARTICLE_EXCERPT_MAX,
  CAREER_ARTICLE_CONTENT_MAX,
  CAREER_ARTICLE_CATEGORY_MAX,
} from "@/lib/validations";

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    title: "How to Write a Strong CV",
    slug: "how-to-write-a-strong-cv",
    excerpt: "Practical steps to build a standout CV.",
    content: "Start with a clear summary.\nThen list your experience.",
    category: "Resume tips",
    status: "DRAFT",
    ...overrides,
  };
}

function issuePaths(result: { success: false; error: { issues: { path: PropertyKey[] }[] } }) {
  return result.error.issues.map((issue) => issue.path.join("."));
}

describe("career article limits", () => {
  it("exports the chosen bounds", () => {
    expect(CAREER_ARTICLE_TITLE_MAX).toBe(200);
    expect(CAREER_ARTICLE_EXCERPT_MAX).toBe(500);
    expect(CAREER_ARTICLE_CONTENT_MAX).toBe(20000);
    expect(CAREER_ARTICLE_CATEGORY_MAX).toBe(100);
  });
});

describe("createCareerArticleSchema", () => {
  it("accepts a valid existing payload unchanged", () => {
    const input = validInput();
    const result = createCareerArticleSchema.safeParse(input);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(input);
  });

  it("accepts a minimal payload and preserves optional/default behavior", () => {
    const result = createCareerArticleSchema.safeParse({
      title: "Interview Basics",
      slug: "interview-basics",
      content: "Prepare your answers.",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("DRAFT");
      expect(result.data.excerpt).toBeUndefined();
      expect(result.data.category).toBeUndefined();
    }
  });

  it("accepts explicit null optional fields", () => {
    const result = createCareerArticleSchema.safeParse(
      validInput({ excerpt: null, category: null }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.excerpt).toBeNull();
      expect(result.data.category).toBeNull();
    }
  });

  it("requires title, slug and content", () => {
    for (const field of ["title", "slug", "content"]) {
      const input = validInput();
      delete (input as Record<string, unknown>)[field];
      const result = createCareerArticleSchema.safeParse(input);
      expect(result.success, `missing ${field}`).toBe(false);
      if (!result.success) expect(issuePaths(result)).toContain(field);
    }
  });

  it("trims surrounding whitespace from all bounded text fields", () => {
    const result = createCareerArticleSchema.safeParse(
      validInput({
        title: "  Article title  ",
        excerpt: "  Short summary  ",
        content: "  Article body  ",
        category: "  Career Tips  ",
      }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Article title");
      expect(result.data.excerpt).toBe("Short summary");
      expect(result.data.content).toBe("Article body");
      expect(result.data.category).toBe("Career Tips");
    }
  });

  it("rejects whitespace-only required title", () => {
    const result = createCareerArticleSchema.safeParse(
      validInput({ title: "   \t\n " }),
    );

    expect(result.success).toBe(false);
    if (!result.success) expect(issuePaths(result)).toContain("title");
  });

  it("rejects whitespace-only required content", () => {
    const result = createCareerArticleSchema.safeParse(
      validInput({ content: "   \t\n " }),
    );

    expect(result.success).toBe(false);
    if (!result.success) expect(issuePaths(result)).toContain("content");
  });

  it("normalizes whitespace-only optional fields to empty strings", () => {
    const result = createCareerArticleSchema.safeParse(
      validInput({ excerpt: "   ", category: "\t\n" }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.excerpt).toBe("");
      expect(result.data.category).toBe("");
    }
  });

  it("accepts title at the maximum length", () => {
    const result = createCareerArticleSchema.safeParse(
      validInput({ title: "a".repeat(CAREER_ARTICLE_TITLE_MAX) }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects title over the maximum length", () => {
    const result = createCareerArticleSchema.safeParse(
      validInput({ title: "a".repeat(CAREER_ARTICLE_TITLE_MAX + 1) }),
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(issuePaths(result)).toContain("title");
  });

  it("accepts excerpt at the maximum length", () => {
    const result = createCareerArticleSchema.safeParse(
      validInput({ excerpt: "e".repeat(CAREER_ARTICLE_EXCERPT_MAX) }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects excerpt over the maximum length", () => {
    const result = createCareerArticleSchema.safeParse(
      validInput({ excerpt: "e".repeat(CAREER_ARTICLE_EXCERPT_MAX + 1) }),
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(issuePaths(result)).toContain("excerpt");
  });

  it("accepts content at the maximum length", () => {
    const result = createCareerArticleSchema.safeParse(
      validInput({ content: "c".repeat(CAREER_ARTICLE_CONTENT_MAX) }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects content over the maximum length", () => {
    const result = createCareerArticleSchema.safeParse(
      validInput({ content: "c".repeat(CAREER_ARTICLE_CONTENT_MAX + 1) }),
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(issuePaths(result)).toContain("content");
  });

  it("accepts category at the maximum length", () => {
    const result = createCareerArticleSchema.safeParse(
      validInput({ category: "g".repeat(CAREER_ARTICLE_CATEGORY_MAX) }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects category over the maximum length", () => {
    const result = createCareerArticleSchema.safeParse(
      validInput({ category: "g".repeat(CAREER_ARTICLE_CATEGORY_MAX + 1) }),
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(issuePaths(result)).toContain("category");
  });

  it("applies maximum length after trimming", () => {
    const result = createCareerArticleSchema.safeParse(
      validInput({ title: `  ${"a".repeat(CAREER_ARTICLE_TITLE_MAX)}  ` }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toHaveLength(CAREER_ARTICLE_TITLE_MAX);
    }
  });

  it("keeps HTML-like text verbatim (no sanitizing or markup conversion)", () => {
    const payload = validInput({
      title: "<script>alert(1)</script>",
      excerpt: '<img onerror="alert(1)" src=x>',
      content: "<b>plain</b> & <img onerror=alert(1)>",
    });
    const result = createCareerArticleSchema.safeParse(payload);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe(payload.title);
      expect(result.data.excerpt).toBe(payload.excerpt);
      expect(result.data.content).toBe(payload.content);
    }
  });

  it("still rejects unknown fields (strict mode)", () => {
    const result = createCareerArticleSchema.safeParse(
      validInput({ unexpected: "value" }),
    );
    expect(result.success).toBe(false);
  });
});

describe("updateCareerArticleSchema", () => {
  it("accepts an empty patch", () => {
    expect(updateCareerArticleSchema.safeParse({}).success).toBe(true);
  });

  it("trims and bounds provided fields only", () => {
    const result = updateCareerArticleSchema.safeParse({
      title: "  Renamed  ",
      content: "a".repeat(CAREER_ARTICLE_CONTENT_MAX + 1),
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(issuePaths(result)).toContain("content");

    const trimmed = updateCareerArticleSchema.safeParse({
      title: "  Renamed  ",
      category: "  Tips  ",
    });
    expect(trimmed.success).toBe(true);
    if (trimmed.success) {
      expect(trimmed.data.title).toBe("Renamed");
      expect(trimmed.data.category).toBe("Tips");
      expect(trimmed.data.slug).toBeUndefined();
    }
  });

  it("rejects whitespace-only required fields when provided", () => {
    const result = updateCareerArticleSchema.safeParse({ title: "   " });
    expect(result.success).toBe(false);
    if (!result.success) expect(issuePaths(result)).toContain("title");
  });
});
