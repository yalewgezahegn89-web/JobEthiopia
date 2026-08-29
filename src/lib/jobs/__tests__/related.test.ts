import { describe, it, expect } from "vitest";
import { selectRelatedJobs } from "../related";
import type { PublicJobSummary } from "../public";

function makeJob(
  overrides: Partial<PublicJobSummary> = {},
): PublicJobSummary {
  return {
    id: "123e4567-e89b-12d3-a456-426614174000",
    title: "Staff Nurse",
    slug: "staff-nurse",
    organizationId: null,
    categoryId: null,
    professionId: null,
    locationId: null,
    organizationName: "Black Lion Hospital",
    locationName: "Addis Ababa",
    categoryName: "Healthcare",
    professionName: "Nursing",
    employmentType: "FULL_TIME",
    salaryText: "50,000 - 100,000 ETB / monthly",
    deadlineText: "Feb 15, 2026",
    postedAt: "2026-01-15T00:00:00.000Z",
    deadline: "2026-02-15T00:00:00.000Z",
    verificationStatus: "VERIFIED",
    status: "PUBLISHED",
    ...overrides,
  };
}

const current = makeJob();
const sameCategory = makeJob({
  id: "123e4567-e89b-12d3-a456-426614174001",
  title: "Pediatric Nurse",
  slug: "pediatric-nurse",
});
const sameProfession = makeJob({
  id: "123e4567-e89b-12d3-a456-426614174002",
  title: "Home Health Nurse",
  slug: "home-health-nurse",
  categoryName: "Community",
});
const bothMatch = makeJob({
  id: "123e4567-e89b-12d3-a456-426614174003",
  title: "ICU Nurse",
  slug: "icu-nurse",
});
const unrelated = makeJob({
  id: "123e4567-e89b-12d3-a456-426614174004",
  title: "Software Engineer",
  slug: "software-engineer",
  categoryName: "Technology",
  professionName: "Engineering",
});
const thirdMatch = makeJob({
  id: "123e4567-e89b-12d3-a456-426614174005",
  title: "Ward Nurse",
  slug: "ward-nurse",
  categoryName: "Community",
  professionName: "Nursing",
});

describe("selectRelatedJobs", () => {
  it("matches jobs with the same category", () => {
    const result = selectRelatedJobs(
      [current, sameCategory, unrelated],
      current.id,
      { category: "Healthcare" },
    );

    expect(result.map((item) => item.id)).toEqual([sameCategory.id]);
  });

  it("matches jobs with the same profession", () => {
    const result = selectRelatedJobs(
      [current, sameProfession, unrelated],
      current.id,
      { profession: "Nursing" },
    );

    expect(result.map((item) => item.id)).toEqual([sameProfession.id]);
  });

  it("matches jobs sharing either category or profession", () => {
    const result = selectRelatedJobs(
      [current, sameCategory, sameProfession, unrelated],
      current.id,
      { category: "Healthcare", profession: "Nursing" },
    );

    expect(result.map((item) => item.id)).toEqual([
      sameCategory.id,
      sameProfession.id,
    ]);
  });

  it("ranks jobs matching both category and profession before jobs matching one", () => {
    const both = bothMatch;
    const categoryOnly = sameCategory;
    const professionOnly = sameProfession;
    const result = selectRelatedJobs(
      [current, both, categoryOnly, professionOnly, unrelated],
      current.id,
      { category: "Healthcare", profession: "Nursing" },
    );

    expect(result.map((item) => item.id)).toEqual([
      both.id,
      categoryOnly.id,
      professionOnly.id,
    ]);
  });

  it("excludes the current job", () => {
    const result = selectRelatedJobs(
      [current, sameCategory],
      current.id,
      { category: "Healthcare" },
    );

    expect(result.map((item) => item.id)).not.toContain(current.id);
    expect(result.map((item) => item.id)).toEqual([sameCategory.id]);
  });

  it("preserves source ordering within the same match level", () => {
    const a = makeJob({ id: "00000000-0000-0000-0000-000000000011", title: "A" });
    const b = makeJob({ id: "00000000-0000-0000-0000-000000000012", title: "B" });
    const c = makeJob({ id: "00000000-0000-0000-0000-000000000013", title: "C" });
    const result = selectRelatedJobs(
      [c, a, b],
      current.id,
      { category: "Healthcare", profession: "Nursing" },
      3,
    );

    expect(result.map((item) => item.id)).toEqual([c.id, a.id, b.id]);
  });

  it("limits results to the default count of 3", () => {
    const a = makeJob({ id: "00000000-0000-0000-0000-000000000021", title: "A" });
    const b = makeJob({ id: "00000000-0000-0000-0000-000000000022", title: "B" });
    const c = makeJob({ id: "00000000-0000-0000-0000-000000000023", title: "C" });
    const d = makeJob({ id: "00000000-0000-0000-0000-000000000024", title: "D" });
    const result = selectRelatedJobs(
      [current, a, b, c, d],
      current.id,
      { category: "Healthcare" },
    );

    expect(result).toHaveLength(3);
    expect(result.map((item) => item.id)).toEqual([a.id, b.id, c.id]);
  });

  it("respects an explicit count", () => {
    const result = selectRelatedJobs(
      [sameCategory, thirdMatch],
      current.id,
      { category: "Healthcare" },
      1,
    );

    expect(result).toHaveLength(1);
  });

  it("returns an empty array when count is 0", () => {
    const result = selectRelatedJobs(
      [sameCategory],
      current.id,
      { category: "Healthcare" },
      0,
    );

    expect(result).toEqual([]);
  });

  it("returns an empty array for a negative count", () => {
    const result = selectRelatedJobs(
      [sameCategory],
      current.id,
      { category: "Healthcare" },
      -1,
    );

    expect(result).toEqual([]);
  });

  it("returns an empty array when options are null/empty", () => {
    expect(selectRelatedJobs([sameCategory], current.id, {})).toEqual([]);
    expect(
      selectRelatedJobs([sameCategory], current.id, {
        category: null,
        profession: null,
      }),
    ).toEqual([]);
  });

  it("returns an empty array for empty input", () => {
    const result = selectRelatedJobs([], current.id, {
      category: "Healthcare",
    });

    expect(result).toEqual([]);
  });

  it("returns an empty array when nothing matches", () => {
    const result = selectRelatedJobs(
      [unrelated],
      current.id,
      { category: "Healthcare", profession: "Nursing" },
    );

    expect(result).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const items = [current, sameCategory, sameProfession, unrelated];
    const snapshot = items.map((item) => item.id);

    selectRelatedJobs(items, current.id, {
      category: "Healthcare",
      profession: "Nursing",
    });

    expect(items.map((item) => item.id)).toEqual(snapshot);
  });
});
