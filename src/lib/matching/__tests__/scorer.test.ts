import { describe, it, expect } from "vitest";
import {
  professionAndCategoryFactor,
  locationFactor,
  experienceFactor,
  employmentTypeFactor,
  containsSkill,
  skillsFactor,
  freshnessFactor,
  scoreJobMatch,
  round4,
} from "@/lib/matching/scorer";
import { MATCH_WEIGHTS, type CandidateMatchProfile, type JobMatchData } from "@/lib/matching/types";

function candidate(overrides: Partial<CandidateMatchProfile> = {}): CandidateMatchProfile {
  return {
    locationId: null,
    locationParentId: null,
    totalExperienceYears: null,
    preferredCategoryIds: [],
    preferredProfessionIds: [],
    preferredEmploymentTypes: [],
    skills: [],
    ...overrides,
  };
}

function job(overrides: Partial<JobMatchData> = {}): JobMatchData {
  return {
    id: "job-1",
    title: "Accountant",
    categoryId: null,
    professionId: null,
    locationId: null,
    locationParentId: null,
    experienceMin: null,
    experienceMax: null,
    employmentType: null,
    searchableText: "accountant prepare financial statements",
    postedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

const BEFORE = 0.001;

describe("professionAndCategoryFactor", () => {
  it("returns 0 when the candidate has no preferences", () => {
    const factor = professionAndCategoryFactor(candidate(), job({ categoryId: "cat1" }));
    expect(factor.score).toBe(0);
    expect(factor.detail.reason).toBe("no-preferences");
  });

  it("returns 1 when the job's profession is preferred", () => {
    const c = candidate({ preferredProfessionIds: ["prof1"] });
    expect(professionAndCategoryFactor(c, job({ professionId: "prof1" })).score).toBe(1);
  });

  it("returns 1 when the job's category is preferred (no profession match)", () => {
    const c = candidate({ preferredCategoryIds: ["cat1"] });
    expect(professionAndCategoryFactor(c, job({ categoryId: "cat1", professionId: "prof-other" })).score).toBe(1);
  });

  it("returns 0 when neither taxonomy matches", () => {
    const c = candidate({ preferredCategoryIds: ["cat1"], preferredProfessionIds: ["prof1"] });
    expect(professionAndCategoryFactor(c, job({ categoryId: "cat9", professionId: "prof9" })).score).toBe(0);
  });

  it("uses a fixed weight", () => {
    const factor = professionAndCategoryFactor(candidate({ preferredCategoryIds: ["cat1"] }), job({ categoryId: "cat1" }));
    expect(factor.weight).toBe(MATCH_WEIGHTS.professionAndCategory);
  });
});

describe("locationFactor", () => {
  it("returns 0 when either side lacks a location", () => {
    expect(locationFactor(candidate(), job({ locationId: "loc1" })).score).toBe(0);
    expect(locationFactor(candidate({ locationId: "loc1" }), job()).score).toBe(0);
  });

  it("returns 1 for an exact match", () => {
    const c = candidate({ locationId: "loc1", locationParentId: "region1" });
    expect(locationFactor(c, job({ locationId: "loc1", locationParentId: "region1" })).score).toBe(1);
  });

  it("returns 0.6 for siblings sharing a parent", () => {
    const c = candidate({ locationId: "locA", locationParentId: "region1" });
    expect(locationFactor(c, job({ locationId: "locB", locationParentId: "region1" })).score).toBeCloseTo(0.6, 4);
  });

  it("returns 0.5 for a nested parent↔child relationship", () => {
    const child = candidate({ locationId: "locB", locationParentId: "region1" });
    expect(locationFactor(child, job({ locationId: "region1" })).score).toBeCloseTo(0.5, 4);
    const parent = candidate({ locationId: "region1", locationParentId: null });
    expect(locationFactor(parent, job({ locationId: "locB", locationParentId: "region1" })).score).toBeCloseTo(0.5, 4);
  });

  it("returns 0 for unrelated locations", () => {
    const c = candidate({ locationId: "locA", locationParentId: "region1" });
    expect(locationFactor(c, job({ locationId: "locZ", locationParentId: "region9" })).score).toBe(0);
  });
});

describe("experienceFactor", () => {
  it("returns 1 when no experience is required", () => {
    expect(experienceFactor(candidate({ totalExperienceYears: 0 }), job()).score).toBe(1);
    expect(experienceFactor(candidate({ totalExperienceYears: 9 }), job({ experienceMin: null, experienceMax: null })).score).toBe(1);
  });

  it("returns 0 when candidate years are unknown but a requirement exists", () => {
    expect(experienceFactor(candidate({ totalExperienceYears: null }), job({ experienceMin: 3 })).score).toBe(0);
  });

  it("returns 1 when years are within range", () => {
    expect(experienceFactor(candidate({ totalExperienceYears: 4 }), job({ experienceMin: 2, experienceMax: 6 })).score).toBe(1);
  });

  it("returns 1 when only the minimum applies and years exceed it", () => {
    expect(experienceFactor(candidate({ totalExperienceYears: 9 }), job({ experienceMin: 3, experienceMax: null })).score).toBe(1);
  });

  it("returns 0.6 when overqualified against a maximum", () => {
    const factor = experienceFactor(candidate({ totalExperienceYears: 10 }), job({ experienceMin: 2, experienceMax: 5 }));
    expect(factor.score).toBeCloseTo(0.6, 4);
    expect(factor.detail.gap).toBe(5);
  });

  it("returns 0.5 when close to (within 2 years of) the minimum", () => {
    const factor = experienceFactor(candidate({ totalExperienceYears: 2 }), job({ experienceMin: 4, experienceMax: 8 }));
    expect(factor.score).toBeCloseTo(0.5, 4);
    expect(factor.detail.gap).toBe(2);
  });

  it("returns 0 when well below the minimum", () => {
    expect(experienceFactor(candidate({ totalExperienceYears: 1 }), job({ experienceMin: 5, experienceMax: 8 })).score).toBe(0);
  });
});

describe("employmentTypeFactor", () => {
  it("is neutral 0.5 without a candidate preference", () => {
    expect(employmentTypeFactor(candidate(), job({ employmentType: "FULL_TIME" })).score).toBe(0.5);
  });

  it("is neutral 0.5 when the job does not state a type", () => {
    expect(employmentTypeFactor(candidate({ preferredEmploymentTypes: ["FULL_TIME"] }), job()).score).toBe(0.5);
  });

  it("returns 1 on a match and 0 on a mismatch", () => {
    const c = candidate({ preferredEmploymentTypes: ["FULL_TIME"] });
    expect(employmentTypeFactor(c, job({ employmentType: "FULL_TIME" })).score).toBe(1);
    expect(employmentTypeFactor(c, job({ employmentType: "CONTRACT" })).score).toBe(0);
  });
});

describe("containsSkill", () => {
  it("matches at word boundaries only", () => {
    expect(containsSkill("we need a react developer", "react")).toBe(true);
    expect(containsSkill("we hired a paris-based engineer", "paris")).toBe(true);
    expect(containsSkill("we hired a parisian engineer", "paris")).toBe(false);
  });

  it("matches case-insensitively", () => {
    expect(containsSkill("REACT developer", "react")).toBe(true);
  });

  it("escapes regex special characters", () => {
    expect(containsSkill("c++ developer", "c++")).toBe(true);
    expect(containsSkill("c# and .net", "c#")).toBe(true);
    expect(containsSkill("c# and .net", ".net")).toBe(true);
  });

  it("rejects empty skills", () => {
    expect(containsSkill("anything", "")).toBe(false);
  });
});

describe("skillsFactor", () => {
  it("returns 0 when the candidate lists no skills", () => {
    const factor = skillsFactor(candidate(), job());
    expect(factor.score).toBe(0);
    expect(factor.detail.reason).toBe("no-skills");
  });

  it("returns 0 when the job has no searchable text", () => {
    const c = candidate({ skills: ["react"] });
    const factor = skillsFactor(c, job({ searchableText: "" }));
    expect(factor.score).toBe(0);
    expect(factor.detail.reason).toBe("no-job-text");
  });

  it("is capped at 1 once three or more skills match", () => {
    const c = candidate({ skills: ["react", "sql", "typescript", "node"] });
    const text = "react, sql, typescript and node experience preferred";
    const factor = skillsFactor(c, job({ searchableText: text }));
    expect(factor.score).toBe(1);
    expect(factor.detail.matchedCount).toBe(4);
  });

  it("surfaces matched skills for the explanation", () => {
    const c = candidate({ skills: ["react", "oracle"] });
    const factor = skillsFactor(c, job({ searchableText: "react developer" }));
    expect(factor.score).toBeCloseTo(1 / 3, 4);
    expect(factor.detail.matchedSkills).toEqual(["react"]);
  });
});

describe("freshnessFactor", () => {
  const now = new Date("2026-09-10T00:00:00.000Z");

  it("is neutral 0.5 for missing or invalid dates", () => {
    expect(freshnessFactor(candidate(), job({ postedAt: null }), now).score).toBe(0.5);
    expect(freshnessFactor(candidate(), job({ postedAt: "nope" }), now).score).toBe(0.5);
  });

  it("is neutral 0.5 for future dates", () => {
    expect(freshnessFactor(candidate(), job({ postedAt: "2026-09-20T00:00:00.000Z" }), now).score).toBe(0.5);
  });

  it("scores recent (under 7 days) as 1", () => {
    expect(freshnessFactor(candidate(), job({ postedAt: "2026-09-05T00:00:00.000Z" }), now).score).toBe(1);
  });

  it("scores fresh (under 30 days) as 0.7", () => {
    expect(freshnessFactor(candidate(), job({ postedAt: "2026-08-25T00:00:00.000Z" }), now).score).toBeCloseTo(0.7, 4);
  });

  it("scores older jobs as 0.4", () => {
    expect(freshnessFactor(candidate(), job({ postedAt: "2026-06-01T00:00:00.000Z" }), now).score).toBe(0.4);
  });
});

describe("scoreJobMatch", () => {
  it("weights sum to 1", () => {
    const total = Object.values(MATCH_WEIGHTS).reduce((sum, value) => sum + value, 0);
    expect(round4(total)).toBe(1);
  });

  it("yields a perfect 1 for a fully aligned job", () => {
    const c = candidate({
      locationId: "loc1",
      locationParentId: "region1",
      totalExperienceYears: 5,
      preferredCategoryIds: ["cat1"],
      preferredEmploymentTypes: ["FULL_TIME"],
      skills: ["react", "sql", "node"],
    });
    const j = job({
      categoryId: "cat1",
      locationId: "loc1",
      locationParentId: "region1",
      experienceMin: 3,
      experienceMax: 8,
      employmentType: "FULL_TIME",
      searchableText: "react sql node developer in addis",
      postedAt: "2026-09-08T00:00:00.000Z",
    });
    const match = scoreJobMatch(c, j, new Date("2026-09-10T00:00:00.000Z"));
    expect(match.total).toBe(1);
  });

  it("stays within [0, 1] and returns all factors", () => {
    const match = scoreJobMatch(candidate(), job(), new Date("2026-09-10T00:00:00.000Z"));
    expect(match.total).toBeGreaterThanOrEqual(0);
    expect(match.total).toBeLessThanOrEqual(1);
    expect(match.factors).toHaveLength(6);
  });

  it("ranks a strong match above a weak match", () => {
    const c = candidate({
      locationId: "loc1",
      locationParentId: "region1",
      totalExperienceYears: 4,
      preferredCategoryIds: ["cat1"],
      preferredEmploymentTypes: ["FULL_TIME"],
    });
    const now = new Date("2026-09-10T00:00:00.000Z");
    const strong = scoreJobMatch(
      c,
      job({ categoryId: "cat1", locationId: "loc1", locationParentId: "region1", experienceMin: 2, employmentType: "FULL_TIME", postedAt: "2026-09-09T00:00:00.000Z" }),
      now,
    );
    const weak = scoreJobMatch(
      c,
      job({ categoryId: "cat9", professionId: "prof9", locationId: "locZ", locationParentId: "region9", experienceMin: 2, employmentType: "CONTRACT", postedAt: "2026-05-01T00:00:00.000Z" }),
      now,
    );
    expect(strong.total).toBeGreaterThan(weak.total);
  });

  it("refuses to exceed 1 even if factor inputs are odd", () => {
    const match = scoreJobMatch(candidate(), job(), new Date("2026-09-10T00:00:00.000Z"));
    expect(match.total).toBeLessThanOrEqual(1 + BEFORE);
  });
});