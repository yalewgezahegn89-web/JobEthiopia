import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { dictionaries } from "@/lib/i18n/dictionary";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

vi.mock("@/components/job-card", () => ({
  default: () => createElement("div", { "data-testid": "job-card-stub" }),
}));

vi.mock("@/components/recommendations/recommendation-feedback", () => ({
  RecommendationFeedback: () => createElement("div", { "data-testid": "feedback-stub" }),
}));

import {
  RecommendationCard,
  buildRecommendationReasons,
  scorePercent,
} from "../recommendation-card";
import type { RecommendationItem } from "@/lib/matching/dal";
import type { MatchFactor, MatchFactorKey } from "@/lib/matching/types";

const en = dictionaries.en;

function factor(
  key: MatchFactorKey,
  score: number,
  detail: Record<string, unknown> = {},
): MatchFactor {
  return { key, weight: 0.1, score, detail } as unknown as MatchFactor;
}

function item(
  overrides: Partial<Pick<RecommendationItem, "score" | "factors">> = {},
): RecommendationItem {
  return {
    job: {
      id: "job-1",
      title: "Accountant",
      slug: "job-1",
      organizationId: "org-1",
      categoryId: null,
      professionId: null,
      locationId: null,
      organizationName: "ACME Plc",
      locationName: null,
      categoryName: null,
      professionName: null,
      employmentType: null,
      salaryText: null,
      deadlineText: null,
      postedAt: null,
      deadline: null,
      verificationStatus: "VERIFIED",
      status: "PUBLISHED",
    },
    score: 0.82,
    factors: [factor("freshness", 1, { reason: "recent" })],
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetModules();
});

describe("scorePercent", () => {
  it("rounds to a whole percent within [1, 100]", () => {
    expect(scorePercent(0.9183)).toBe(92);
    expect(scorePercent(0.35)).toBe(35);
    expect(scorePercent(1)).toBe(100);
  });

  it("clamps out-of-range factors", () => {
    expect(scorePercent(1.4)).toBe(100);
    expect(scorePercent(-0.2)).toBe(0);
    expect(scorePercent(0.35)).toBe(35);
  });
});

describe("buildRecommendationReasons", () => {
  it("builds one localized line per strongly-matching factor", () => {
    const reasons = buildRecommendationReasons(
      [
        factor("professionAndCategory", 1, { reason: "profession" }),
        factor("location", 1, { reason: "exact" }),
        factor("experience", 1, { reason: "matched" }),
        factor("employmentType", 1, { reason: "matched" }),
        factor("skills", 1, { matchedSkills: ["SQL"], matchedCount: 1, reason: "matched" }),
        factor("freshness", 1, { reason: "recent" }),
      ],
      en,
    );
    expect(reasons).toHaveLength(6);
    expect(reasons.join(" ")).toContain("profession");
    expect(reasons.join(" ")).toContain("your skills");
  });

  it("omits factors that are neutral or below threshold", () => {
    const reasons = buildRecommendationReasons(
      [factor("employmentType", 0.5, {}), factor("location", 0, {})],
      en,
    );
    expect(reasons.length).toBe(0);
  });

  it("returns an empty array for no applicable factors", () => {
    expect(buildRecommendationReasons([], en)).toEqual([]);
  });
});

describe("RecommendationCard", () => {
  it("renders a score label and the shared job card", () => {
    const html = renderToStaticMarkup(
      createElement(RecommendationCard, { item: item({ score: 0.82 }), t: en }),
    );
    expect(html).toContain("82%");
    expect(html).toContain('data-testid="job-card-stub"');
  });

  it("reveals why the job matches inside a details block", () => {
    const html = renderToStaticMarkup(
      createElement(RecommendationCard, {
        item: item({
          factors: [factor("location", 1, { reason: "exact" })],
        }),
        t: en,
      }),
    );
    expect(html).toContain("<details");
    expect(html.toLowerCase()).toContain("why");
  });

  it("renders without a reason block when nothing applies", () => {
    const html = renderToStaticMarkup(
      createElement(RecommendationCard, {
        item: item({ factors: [factor("employmentType", 0.5, {})] }),
        t: en,
      }),
    );
    expect(html.toLowerCase()).not.toContain("why");
  });

  it("renders the feedback component", () => {
    const html = renderToStaticMarkup(
      createElement(RecommendationCard, {
        item: item(),
        t: en,
      }),
    );
    expect(html).toContain('data-testid="feedback-stub"');
  });
});

describe("buildRecommendationReasons with structured skills", () => {
  it("explains required skill matches with count and total", () => {
    const reasons = buildRecommendationReasons(
      [
        factor("skills", 0.8, {
          reason: "structured-required",
          matchedRequired: 3,
          totalRequired: 4,
          matchedPreferred: 0,
          totalPreferred: 0,
          matchedSkills: [],
          matchedCount: 3,
        }),
      ],
      en,
    );
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain("3");
    expect(reasons[0]).toContain("4");
    expect(reasons[0]).toContain("required");
  });

  it("explains preferred skill matches separately", () => {
    const reasons = buildRecommendationReasons(
      [
        factor("skills", 0.6, {
          reason: "structured-required",
          matchedRequired: 2,
          totalRequired: 2,
          matchedPreferred: 1,
          totalPreferred: 2,
          matchedSkills: [],
          matchedCount: 3,
        }),
      ],
      en,
    );
    expect(reasons).toHaveLength(2);
    expect(reasons[0]).toContain("required");
    expect(reasons[1]).toContain("preferred");
  });
});