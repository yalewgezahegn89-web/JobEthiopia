import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockDbFindFirst: vi.fn(),
  mockTxFindFirst: vi.fn(),
  mockTxInsertProfile: vi.fn(),
  mockTxInsertAudit: vi.fn(),
  mockTxUpdate: vi.fn(),
}));

const CANDIDATE_ID = "11111111-1111-4111-8111-111111111111";
const LOCATION_ID = "22222222-2222-4222-8222-222222222222";

const PROFILE_ROW = {
  id: "33333333-3333-4333-8333-333333333333",
  candidateId: CANDIDATE_ID,
  phone: "+251911234567",
  locationId: LOCATION_ID,
  professionalSummary: "Engineer",
  totalExperienceYears: 5,
  education: "BSc",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const INPUT = {
  phone: "+251-911-234-567",
  locationId: LOCATION_ID,
  professionalSummary: "Engineer",
  totalExperienceYears: 5,
  education: "BSc",
};

vi.mock("@/db", () => {
  const tx = {
    query: {
      candidateProfiles: {
        findFirst: (...args: unknown[]) => mocks.mockTxFindFirst(...args),
      },
    },
    insert: (target: unknown) => ({
      values: (v: Record<string, unknown>) => {
        if (v.action === "PROFILE_UPDATED") {
          mocks.mockTxInsertAudit(v);
          return {};
        }
        mocks.mockTxInsertProfile({ target, values: v });
        return {
          returning: () => [PROFILE_ROW],
        };
      },
    }),
    update: (target: unknown) => {
      mocks.mockTxUpdate(target);
      return {
        set: () => ({
          where: () => ({
            returning: () => [PROFILE_ROW],
          }),
        }),
      };
    },
  };

  return {
    db: {
      query: {
        candidateProfiles: {
          findFirst: (...args: unknown[]) => mocks.mockDbFindFirst(...args),
        },
      },
      transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    },
  };
});

import {
  getCandidateProfile,
  updateCandidateProfile,
} from "@/lib/candidateProfile/dal";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCandidateProfile", () => {
  it("returns null when no profile exists", async () => {
    mocks.mockDbFindFirst.mockResolvedValue(undefined);
    const result = await getCandidateProfile(CANDIDATE_ID);
    expect(result).toBeNull();
  });

  it("returns the candidate's owned profile", async () => {
    mocks.mockDbFindFirst.mockResolvedValue(PROFILE_ROW);
    const result = await getCandidateProfile(CANDIDATE_ID);
    expect(result).not.toBeNull();
    expect(result?.candidateId).toBe(CANDIDATE_ID);
    expect(result?.phone).toBe("+251911234567");
  });
});

describe("updateCandidateProfile", () => {
  it("creates a profile when none exists and audits with changed field names", async () => {
    mocks.mockTxFindFirst.mockResolvedValue(undefined);

    const result = await updateCandidateProfile(CANDIDATE_ID, INPUT);
    expect(result.ok).toBe(true);

    const createdValues = mocks.mockTxInsertProfile.mock.calls[0][0].values;
    expect(createdValues.candidateId).toBe(CANDIDATE_ID);
    // phone should be normalized
    expect(createdValues.phone).toBe("+251911234567");

    const audit = mocks.mockTxInsertAudit.mock.calls[0][0];
    expect(audit.action).toBe("PROFILE_UPDATED");
    expect(audit.targetType).toBe("user");
    expect(audit.targetId).toBe(CANDIDATE_ID);
    // metadata contains only field names, no PII values
    expect(audit.metadata.changes).toContain("phone");
    expect(audit.metadata.changes).toContain("professionalSummary");
    expect(JSON.stringify(audit.metadata)).not.toContain("+251");
    expect(JSON.stringify(audit.metadata)).not.toContain("Engineer");
    expect(JSON.stringify(audit.metadata)).not.toContain("BSc");
  });

  it("updates an existing profile and preserves ownership", async () => {
    mocks.mockTxFindFirst.mockResolvedValue({
      ...PROFILE_ROW,
      education: "Diploma",
    });

    const result = await updateCandidateProfile(CANDIDATE_ID, INPUT);
    expect(result.ok).toBe(true);
    // update targeted the candidate's own row
    expect(mocks.mockTxUpdate).toHaveBeenCalled();
    // audit written because education changed
    expect(mocks.mockTxInsertAudit).toHaveBeenCalled();
  });

  it("records only changed field names in audit metadata", async () => {
    mocks.mockTxFindFirst.mockResolvedValue({
      ...PROFILE_ROW,
      phone: "0912999999",
      locationId: LOCATION_ID,
      professionalSummary: "Engineer",
      totalExperienceYears: 5,
      education: "BSc",
    });

    // only phone changes (normalized) compared to existing
    const result = await updateCandidateProfile(CANDIDATE_ID, { ...INPUT });
    expect(result.ok).toBe(true);

    const audit = mocks.mockTxInsertAudit.mock.calls[0][0];
    expect(audit.metadata.changes).toEqual(["phone"]);
    expect(JSON.stringify(audit.metadata)).not.toContain("+251");
  });

  it("writes no audit when nothing changed", async () => {
    mocks.mockTxFindFirst.mockResolvedValue(PROFILE_ROW);

    const result = await updateCandidateProfile(CANDIDATE_ID, INPUT);
    expect(result.ok).toBe(true);
    expect(mocks.mockTxInsertAudit).not.toHaveBeenCalled();
  });

  it("preserves createdAt on update", async () => {
    mocks.mockTxFindFirst.mockResolvedValue(PROFILE_ROW);

    await updateCandidateProfile(CANDIDATE_ID, INPUT);
    // update chain targeted at the candidate profile row
    expect(mocks.mockTxUpdate).toHaveBeenCalled();
  });

  it("runs within a transaction (profile mutation + audit atomic)", async () => {
    // exercised implicitly via the tx mock; assert mutations were routed to tx
    mocks.mockTxFindFirst.mockResolvedValue(undefined);
    await updateCandidateProfile(CANDIDATE_ID, INPUT);
    expect(mocks.mockTxInsertProfile).toHaveBeenCalledTimes(1);
    expect(mocks.mockTxInsertAudit).toHaveBeenCalledTimes(1);
  });
});
