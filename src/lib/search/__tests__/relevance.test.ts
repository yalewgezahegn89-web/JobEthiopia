import { describe, it, expect, vi } from "vitest";

vi.mock("@/db/schema/jobs", () => ({
  jobs: {
    id: "jobs.id",
    title: "jobs.title",
    organizationId: "jobs.organizationId",
    description: "jobs.description",
    createdAt: "jobs.createdAt",
    deadline: "jobs.deadline",
    salaryMin: "jobs.salaryMin",
    salaryMax: "jobs.salaryMax",
  },
}));

import {
  computeRelevanceScore,
  buildRelevanceOrderExpression,
  RELEVANCE_WEIGHTS,
  MIN_TRGM_SIMILARITY,
  type RelevanceMatchFlags,
} from "../relevance";

function sqlRendered(node: unknown): string {
  if (node === null || node === undefined) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(sqlRendered).join("");
  if (typeof node === "object") {
    return Object.values(node as Record<string, unknown>)
      .map(sqlRendered)
      .join("");
  }
  return "";
}

const NO_MATCH: RelevanceMatchFlags = {
  exactTitle: false,
  prefixTitle: false,
  substringTitle: false,
  organization: false,
  description: false,
};

describe("computeRelevanceScore", () => {
  it("returns the exact-title weight when the title matches exactly", () => {
    const score = computeRelevanceScore({
      ...NO_MATCH,
      exactTitle: true,
      prefixTitle: true,
      substringTitle: true,
      description: true,
    });
    expect(score).toBe(RELEVANCE_WEIGHTS.exactTitle);
  });

  it("returns a prefix-title score when only the prefix matches", () => {
    const score = computeRelevanceScore({
      ...NO_MATCH,
      prefixTitle: true,
    });
    expect(score).toBe(RELEVANCE_WEIGHTS.prefixTitle);
  });

  it("returns a substring-title score when only the title contains the term", () => {
    const score = computeRelevanceScore({
      ...NO_MATCH,
      substringTitle: true,
    });
    expect(score).toBe(RELEVANCE_WEIGHTS.substringTitle);
  });

  it("scores an organization-name match above a description match", () => {
    const orgScore = computeRelevanceScore({ ...NO_MATCH, organization: true });
    const descScore = computeRelevanceScore({ ...NO_MATCH, description: true });
    expect(orgScore).toBeGreaterThan(descScore);
  });

  it("returns the description weight for a description-only match", () => {
    const score = computeRelevanceScore({ ...NO_MATCH, description: true });
    expect(score).toBe(RELEVANCE_WEIGHTS.description);
  });

  it("returns zero when nothing matches", () => {
    expect(computeRelevanceScore(NO_MATCH)).toBe(0);
  });

  it("is deterministic for identical inputs", () => {
    const flags = { ...NO_MATCH, substringTitle: true };
    const first = computeRelevanceScore(flags);
    const second = computeRelevanceScore(flags);
    expect(first).toBe(second);
  });

  it("stays within the [0, 1] bounds for every combination", () => {
    for (let exactTitle = 0; exactTitle <= 1; exactTitle += 1) {
      for (let prefixTitle = 0; prefixTitle <= 1; prefixTitle += 1) {
        for (let substringTitle = 0; substringTitle <= 1; substringTitle += 1) {
          for (let organization = 0; organization <= 1; organization += 1) {
            for (let description = 0; description <= 1; description += 1) {
              const score = computeRelevanceScore({
                exactTitle: exactTitle === 1,
                prefixTitle: prefixTitle === 1,
                substringTitle: substringTitle === 1,
                organization: organization === 1,
                description: description === 1,
              });
              expect(score >= 0).toBe(true);
              expect(score <= 1).toBe(true);
            }
          }
        }
      }
    }
  });
});

describe("buildRelevanceOrderExpression", () => {
  it("builds a weighted CASE expression for the substring tier", () => {
    const expression = buildRelevanceOrderExpression({
      q: "nurse",
      organizationIds: [],
      trgm: false,
    });
    const rendered = sqlRendered(expression);
    expect(rendered).toContain("CASE");
    expect(rendered).toContain("LOWER");
    expect(rendered).toContain("ILIKE");
    expect(rendered).toContain(String(RELEVANCE_WEIGHTS.exactTitle));
    expect(rendered).toContain(String(RELEVANCE_WEIGHTS.prefixTitle));
    expect(rendered).toContain(String(RELEVANCE_WEIGHTS.substringTitle));
    expect(rendered).not.toContain("similarity");
  });

  it("prefers exact-title over prefix, substring, org and description in one pass", () => {
    const expression = buildRelevanceOrderExpression({
      q: "nurse",
      organizationIds: [],
      trgm: false,
    });
    const rendered = sqlRendered(expression);
    const exact = rendered.indexOf("= LOWER");
    const prefix = rendered.indexOf("ILIKE");
    expect(exact).toBeGreaterThanOrEqual(0);
    expect(exact).toBeLessThan(prefix);
  });

  it("builds a GREATEST(similarity(...)) expression for the trgm tier", () => {
    const expression = buildRelevanceOrderExpression({
      q: "nurse",
      organizationIds: ["org-1"],
      trgm: true,
    });
    const rendered = sqlRendered(expression);
    expect(rendered).toContain("GREATEST");
    expect(rendered).toContain("similarity");
    expect(rendered).toContain(String(RELEVANCE_WEIGHTS.organization));
    expect(rendered).not.toContain("ILIKE");
  });

  it("keeps the org boost as an ANY clause when ids are provided", () => {
    const expression = buildRelevanceOrderExpression({
      q: "nurse",
      organizationIds: ["org-1"],
      trgm: true,
    });
    expect(sqlRendered(expression)).toContain("ANY");
  });

  it("keeps MIN_TRGM_SIMILARITY in a dedicated exported constant", () => {
    expect(MIN_TRGM_SIMILARITY).toBeGreaterThan(0);
    expect(MIN_TRGM_SIMILARITY).toBeLessThan(1);
  });
});