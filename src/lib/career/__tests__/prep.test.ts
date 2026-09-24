import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  state: {
    rows: [] as Record<string, unknown>[],
    selectCalls: [] as unknown[],
  },
}));

vi.mock("@/db", () => {
  const db = {
    select: vi.fn((opts: unknown) => {
      mocks.state.selectCalls.push(opts);
      return {
        from: () => ({
          innerJoin: () => ({
            where: async () => mocks.state.rows,
          }),
        }),
      };
    }),
  };
  return { db };
});

import { buildExperienceText, loadJobSkillsWithNames } from "@/lib/career/prep";

const JOB_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const JOB_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function reset() {
  mocks.state.rows = [];
  mocks.state.selectCalls = [];
}

beforeEach(() => {
  vi.clearAllMocks();
  reset();
});

describe("buildExperienceText", () => {
  it("returns null when both bounds are unknown", () => {
    expect(buildExperienceText(null, null)).toBeNull();
  });

  it("renders a single exact value", () => {
    expect(buildExperienceText(3, 3)).toBe("3 years");
  });

  it("renders a min - max range", () => {
    expect(buildExperienceText(3, 5)).toBe("3 - 5 years");
  });

  it("renders a minimum-only bound", () => {
    expect(buildExperienceText(3, null)).toBe("3+ years");
  });

  it("renders a maximum-only bound", () => {
    expect(buildExperienceText(null, 5)).toBe("Up to 5 years");
  });
});

describe("loadJobSkillsWithNames", () => {
  it("returns an empty map for no job ids without querying", async () => {
    const result = await loadJobSkillsWithNames([]);
    expect(result.size).toBe(0);
    expect(mocks.state.selectCalls).toHaveLength(0);
  });

  it("groups rows by job id and maps name + isRequired", async () => {
    mocks.state.rows = [
      { jobId: JOB_A, name: "Accounting", isRequired: true },
      { jobId: JOB_A, name: "Excel", isRequired: false },
      { jobId: JOB_B, name: "Audit", isRequired: true },
    ];

    const result = await loadJobSkillsWithNames([JOB_A, JOB_B]);

    expect(result.size).toBe(2);
    expect(result.get(JOB_A)).toEqual([
      { name: "Accounting", isRequired: true },
      { name: "Excel", isRequired: false },
    ]);
    expect(result.get(JOB_B)).toEqual([{ name: "Audit", isRequired: true }]);
  });

  it("sorts each job's skills alphabetically by name", async () => {
    mocks.state.rows = [
      { jobId: JOB_A, name: "Excel", isRequired: true },
      { jobId: JOB_A, name: "Audit", isRequired: true },
      { jobId: JOB_A, name: "Accounting", isRequired: false },
    ];

    const result = await loadJobSkillsWithNames([JOB_A]);

    expect(result.get(JOB_A)!.map((s) => s.name)).toEqual(["Accounting", "Audit", "Excel"]);
  });

  it("skips jobs with no matching taxonomy rows", async () => {
    mocks.state.rows = [{ jobId: JOB_A, name: "Excel", isRequired: false }];

    const result = await loadJobSkillsWithNames([JOB_A, JOB_B]);

    expect(result.has(JOB_A)).toBe(true);
    expect(result.has(JOB_B)).toBe(false);
  });

  it("selects only jobId, isRequired, and name columns", async () => {
    mocks.state.rows = [];
    await loadJobSkillsWithNames([JOB_A]);

    expect(mocks.state.selectCalls).toHaveLength(1);
    const cols = mocks.state.selectCalls[0] as Record<string, unknown>;
    expect(Object.keys(cols).sort()).toEqual(["isRequired", "jobId", "name"]);
  });
});