import { describe, it, expect, vi } from "vitest";

vi.mock("@/db/schema/jobs", () => ({
  jobs: {
    id: "jobs.id",
    title: "jobs.title",
    organizationId: "jobs.organizationId",
    description: "jobs.description",
    createdAt: "jobs.createdAt",
    updatedAt: "jobs.updatedAt",
    deadline: "jobs.deadline",
    salaryMin: "jobs.salaryMin",
    salaryMax: "jobs.salaryMax",
  },
}));

import {
  buildSalaryConditions,
  buildKeywordMatchCondition,
  buildJobListOrder,
  type SearchTier,
} from "../jobSearch";

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

describe("buildSalaryConditions", () => {
  it("creates no conditions when no bounds are given", () => {
    expect(buildSalaryConditions()).toHaveLength(0);
  });

  it("uses the job's upper bound for a minimum-salary filter", () => {
    const [condition] = buildSalaryConditions(5000);
    const rendered = sqlRendered(condition);
    expect(rendered).toContain("salaryMax");
    expect(rendered).toContain(">=");
    expect(rendered).not.toContain("salaryMin");
  });

  it("uses the job's lower bound for a maximum-salary filter", () => {
    const [condition] = buildSalaryConditions(undefined, 10000);
    const rendered = sqlRendered(condition);
    expect(rendered).toContain("salaryMin");
    expect(rendered).toContain("<=");
    expect(rendered).not.toContain("salaryMax");
  });

  it("combines both bounds without changing eligibility semantics", () => {
    const conditions = buildSalaryConditions(5000, 10000);
    expect(conditions).toHaveLength(2);
    const rendered = sqlRendered(conditions);
    expect(rendered).toContain("salaryMin");
    expect(rendered).toContain("salaryMax");
  });

  it("always allows jobs with an unset salary through each bound", () => {
    const [minCondition] = buildSalaryConditions(5000);
    const renderedMin = sqlRendered(minCondition);
    expect(renderedMin).toContain("IS NULL");
  });
});

describe("buildKeywordMatchCondition", () => {
  it.each<[SearchTier, boolean]>([
    ["substring", false],
    ["trgm", true],
  ])("builds a %s-tier match built from title and description", (tier, trgm) => {
    const condition = buildKeywordMatchCondition({
      q: "nurse",
      organizationNameIds: [],
      tier,
    });
    const rendered = sqlRendered(condition);
    expect(rendered).toContain("ilike");
    expect(rendered).toContain("title");
    expect(rendered).toContain("description");
    if (trgm) {
      expect(rendered).toContain("similarity");
    } else {
      expect(rendered).not.toContain("similarity");
    }
  });

  it("includes organization-name ids as an additional match path", () => {
    const condition = buildKeywordMatchCondition({
      q: "black lion",
      organizationNameIds: ["org-1"],
      tier: "substring",
    });
    const rendered = sqlRendered(condition);
    expect(rendered).toContain("organizationId");
  });

  it("omits organization matching when there are no name hits", () => {
    const condition = buildKeywordMatchCondition({
      q: "nurse",
      organizationNameIds: [],
      tier: "substring",
    });
    expect(sqlRendered(condition)).not.toContain("organizationId");
  });

  it("adds trigram similarity thresholds only for the trgm tier", () => {
    const trgm = buildKeywordMatchCondition({
      q: "nurse",
      organizationNameIds: [],
      tier: "trgm",
    });
    const substring = buildKeywordMatchCondition({
      q: "nurse",
      organizationNameIds: [],
      tier: "substring",
    });
    expect(sqlRendered(trgm)).toContain("similarity");
    expect(sqlRendered(substring)).not.toContain("similarity");
  });
});

describe("buildJobListOrder", () => {
  const baseInput = { q: "nurse", organizationIds: [], trgm: false };

  it("orders by newest with a stable id tie-break", () => {
    const order = buildJobListOrder("newest", baseInput);
    const rendered = sqlRendered(order);
    expect(rendered).toContain("desc");
    expect(rendered).toContain("asc");
  });

  it("orders by deadline with NULLS LAST and a createdAt tie-break", () => {
    const order = buildJobListOrder("deadline", baseInput);
    const rendered = sqlRendered(order);
    expect(rendered).toContain("deadline");
    expect(rendered).toContain("NULLS LAST");
    expect(rendered).toContain("createdAt");
  });

  it("orders by a relevance score for relevance mode", () => {
    const order = buildJobListOrder("relevance", baseInput);
    const rendered = sqlRendered(order);
    expect(rendered).toContain("CASE");
    expect(rendered).toContain("LOWER");
  });

  it("uses trigram similarity ordering in relevance mode when enabled", () => {
    const order = buildJobListOrder("relevance", {
      ...baseInput,
      trgm: true,
    });
    const rendered = sqlRendered(order);
    expect(rendered).toContain("GREATEST");
  });
});