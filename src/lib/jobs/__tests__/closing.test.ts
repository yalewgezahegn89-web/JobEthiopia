import { describe, it, expect } from "vitest";
import { selectClosingJobs } from "../closing";
import type { PublicJobSummary } from "../public";

const NOW = new Date("2026-08-29T12:00:00.000Z");

function makeJob(overrides: Partial<PublicJobSummary> = {}): PublicJobSummary {
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
    deadlineText: "Sep 1, 2026",
    postedAt: "2026-08-20T00:00:00.000Z",
    deadline: "2026-09-01T00:00:00.000Z",
    verificationStatus: "VERIFIED",
    status: "PUBLISHED",
    ...overrides,
  };
}

function iso(daysFromNow: number): string {
  return new Date(NOW.getTime() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();
}

function closingJob(id: string): PublicJobSummary {
  return makeJob({ id, deadline: iso(3) });
}

describe("selectClosingJobs", () => {
  it("returns jobs with closingState CLOSING", () => {
    const result = selectClosingJobs(
      [closingJob("a"), closingJob("b")],
      { now: NOW },
    );

    expect(result.map((j) => j.id)).toEqual(["a", "b"]);
  });

  it("excludes OPEN jobs", () => {
    const jobs = [
      closingJob("a"),
      makeJob({ id: "b", deadline: iso(30) }),
    ];

    const result = selectClosingJobs(jobs, { now: NOW });

    expect(result.map((j) => j.id)).toEqual(["a"]);
  });

  it("excludes EXPIRED jobs", () => {
    const jobs = [
      closingJob("a"),
      makeJob({ id: "b", deadline: iso(-5) }),
    ];

    const result = selectClosingJobs(jobs, { now: NOW });

    expect(result.map((j) => j.id)).toEqual(["a"]);
  });

  it("excludes jobs whose status is EXPIRED even with near deadline", () => {
    const jobs = [
      closingJob("a"),
      makeJob({ id: "b", deadline: iso(2), status: "EXPIRED" }),
    ];

    const result = selectClosingJobs(jobs, { now: NOW });

    expect(result.map((j) => j.id)).toEqual(["a"]);
  });

  it("excludes null deadlines", () => {
    const jobs = [
      closingJob("a"),
      makeJob({ id: "b", deadline: null }),
    ];

    const result = selectClosingJobs(jobs, { now: NOW });

    expect(result.map((j) => j.id)).toEqual(["a"]);
  });

  it("excludes invalid deadlines", () => {
    const jobs = [
      closingJob("a"),
      makeJob({ id: "b", deadline: "not-a-date" }),
    ];

    const result = selectClosingJobs(jobs, { now: NOW });

    expect(result.map((j) => j.id)).toEqual(["a"]);
  });

  it("defaults count to 5", () => {
    const jobs = Array.from({ length: 8 }, (_, i) =>
      closingJob(`job-${i}`),
    );

    const result = selectClosingJobs(jobs, { now: NOW });

    expect(result).toHaveLength(5);
  });

  it("respects explicit count", () => {
    const jobs = Array.from({ length: 8 }, (_, i) =>
      closingJob(`job-${i}`),
    );

    const result = selectClosingJobs(jobs, { now: NOW, count: 3 });

    expect(result).toHaveLength(3);
  });

  it("returns [] when count is 0", () => {
    const result = selectClosingJobs([closingJob("a")], { now: NOW, count: 0 });

    expect(result).toEqual([]);
  });

  it("returns [] when count is negative", () => {
    const result = selectClosingJobs([closingJob("a")], { now: NOW, count: -2 });

    expect(result).toEqual([]);
  });

  it("returns [] for empty input", () => {
    const result = selectClosingJobs([], { now: NOW });

    expect(result).toEqual([]);
  });

  it("preserves original order", () => {
    const jobs = [
      closingJob("c"),
      makeJob({ id: "a", deadline: iso(30) }),
      closingJob("b"),
      closingJob("d"),
    ];

    const result = selectClosingJobs(jobs, { now: NOW });

    expect(result.map((j) => j.id)).toEqual(["c", "b", "d"]);
  });

  it("does not mutate input", () => {
    const jobs = [
      closingJob("a"),
      makeJob({ id: "b", deadline: iso(30) }),
      closingJob("c"),
    ];
    const original = jobs.map((j) => ({ ...j }));

    selectClosingJobs(jobs, { now: NOW });

    expect(jobs).toEqual(original);
  });

  it("uses injected now deterministically", () => {
    const job = makeJob({
      id: "timed",
      deadline: "2026-09-05T12:00:00.000Z",
    });

    const early = new Date("2026-08-10T12:00:00.000Z");
    const late = new Date("2026-08-30T12:00:00.000Z");

    const earlyResult = selectClosingJobs([job], { now: early });
    const lateResult = selectClosingJobs([job], { now: late });

    expect(earlyResult).toEqual([]);
    expect(lateResult.map((j) => j.id)).toEqual(["timed"]);
  });

  it("includes a deadline exactly at the 7-day closing window", () => {
    const exactlyWeek = makeJob({ id: "edge", deadline: iso(7) });

    const result = selectClosingJobs([exactlyWeek], { now: NOW });

    expect(result.map((j) => j.id)).toEqual(["edge"]);
  });

  it("excludes a deadline just outside the closing window", () => {
    const justOver = makeJob({
      id: "outside",
      deadline: iso(7.01),
    });

    const result = selectClosingJobs([justOver], { now: NOW });

    expect(result).toEqual([]);
  });

  it("excludes a past deadline", () => {
    const past = makeJob({ id: "past", deadline: iso(-1) });

    const result = selectClosingJobs([past], { now: NOW });

    expect(result).toEqual([]);
  });
});
