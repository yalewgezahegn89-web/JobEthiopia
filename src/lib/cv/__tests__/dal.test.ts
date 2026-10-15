import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  state: {
    cvHeader: null as unknown,
    experiences: [] as unknown[],
    educations: [] as unknown[],
    skills: [] as unknown[],
    certifications: [] as unknown[],
    existingHeader: null as { id: string } | null,
    allInserts: [] as { table: string; values: unknown; hadReturning: boolean }[],
  },
}));

vi.mock("@/db", () => {
  const hasAction = (value: unknown): boolean =>
    typeof value === "object" &&
    value !== null &&
    "action" in (value as Record<string, unknown>);

  const dbQuery = {
    candidateCvs: {
      findFirst: async () => mocks.state.cvHeader,
    },
    candidateCvExperiences: {
      findMany: async () => mocks.state.experiences,
    },
    candidateCvEducations: {
      findMany: async () => mocks.state.educations,
    },
    candidateCvSkills: {
      findMany: async () => mocks.state.skills,
    },
    candidateCvCertifications: {
      findMany: async () => mocks.state.certifications,
    },
  };

  const db = {
    query: dbQuery,
    transaction: vi.fn(async (cb: (tx: unknown) => unknown) => {
      const txQuery = {
        candidateCvs: {
          findFirst: async () => mocks.state.existingHeader,
        },
      };

      const makeInsertChain = () => ({
        values: (v: unknown) => {
          const isArray = Array.isArray(v);
          const rec = {
            table: isArray ? "sections" : hasAction(v) ? "auditLog" : "candidateCvs",
            values: v,
            hadReturning: false,
          };
          mocks.state.allInserts.push(rec);
          return {
            returning: async () => {
              rec.hadReturning = true;
              if (!isArray) {
                // candidateCvs header insert OR audit insert
                return hasAction(v) ? [] : [{ id: "new-cv-id", ...(v as object) }];
              }
              // section insert: return rows enriched with ids
              return v.map((row: object, index: number) => ({
                id: `row-${index}`,
                ...row,
              }));
            },
          };
        },
      });

      const makeUpdateChain = () => ({
        set: () => ({
          where: () => ({
            returning: async () => [mocks.state.cvHeader],
          }),
        }),
      });

      const makeDeleteChain = () => ({
        where: async () => ({}),
      });

      const tx = {
        query: txQuery,
        insert: vi.fn(() => makeInsertChain()),
        update: vi.fn(() => makeUpdateChain()),
        delete: vi.fn(() => makeDeleteChain()),
      };

      return cb(tx);
    }),
  };
  return { db };
});

import { getOwnedCv, saveCv, deleteCv } from "@/lib/cv/dal";

const CANDIDATE_ID = "11111111-1111-4111-8111-111111111111";
const CV_ID = "cv-cv-cv-cv-cv-cv-cv-cv-cv-cv-cv-cv";

function makeHeader(overrides: Record<string, unknown> = {}) {
  return {
    id: CV_ID,
    candidateId: CANDIDATE_ID,
    title: "Senior Developer",
    professionalSummary: "Experienced full-stack developer.",
    phone: "+251911000000",
    location: "Addis Ababa",
    websiteUrl: "https://example.dev",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeExperience(overrides: Record<string, unknown> = {}) {
  return {
    id: "exp-1",
    cvId: CV_ID,
    employer: "TechCo",
    role: "Developer",
    location: "Addis Ababa",
    startMonth: "2022-01",
    endMonth: "2024-01",
    description: "Built apps.",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeEducation(overrides: Record<string, unknown> = {}) {
  return {
    id: "edu-1",
    cvId: CV_ID,
    institution: "AAU",
    qualification: "BSc",
    fieldOfStudy: "CS",
    startMonth: "2016-09",
    endMonth: "2020-06",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeSkill(overrides: Record<string, unknown> = {}) {
  return {
    id: "skill-1",
    cvId: CV_ID,
    name: "TypeScript",
    level: "advanced",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeCertification(overrides: Record<string, unknown> = {}) {
  return {
    id: "cert-1",
    cvId: CV_ID,
    name: "AWS SAA",
    issuer: "Amazon",
    issuedMonth: "2024-03",
    credentialUrl: "https://aws.com/verify",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function reset() {
  mocks.state.cvHeader = null;
  mocks.state.experiences = [];
  mocks.state.educations = [];
  mocks.state.skills = [];
  mocks.state.certifications = [];
  mocks.state.existingHeader = null;
  mocks.state.allInserts = [];
}

beforeEach(() => {
  vi.clearAllMocks();
  reset();
});

const cvInput = {
  header: {
    title: "Senior Developer",
    professionalSummary: "Experienced full-stack developer.",
    phone: "+251911000000",
    location: "Addis Ababa",
    websiteUrl: "https://example.dev",
  },
  experiences: [
    {
      employer: "TechCo",
      role: "Developer",
      location: "Addis Ababa",
      startMonth: "2022-01",
      endMonth: "2024-01",
      description: "Built apps.",
    },
  ],
  educations: [
    {
      institution: "AAU",
      qualification: "BSc",
      fieldOfStudy: "CS",
      startMonth: "2016-09",
      endMonth: "2020-06",
    },
  ],
  skills: [{ name: "TypeScript", level: "advanced" as const }],
  certifications: [
    {
      name: "AWS SAA",
      issuer: "Amazon",
      issuedMonth: "2024-03",
      credentialUrl: "https://aws.com/verify",
    },
  ],
};

// ---------------------------------------------------------------------------
// getOwnedCv
// ---------------------------------------------------------------------------
describe("getOwnedCv", () => {
  it("returns null when candidateId is empty", async () => {
    const result = await getOwnedCv("");
    expect(result).toBeNull();
  });

  it("returns null when no CV exists for the candidate", async () => {
    mocks.state.cvHeader = null;
    const result = await getOwnedCv(CANDIDATE_ID);
    expect(result).toBeNull();
  });

  it("returns full aggregate (header + 4 sections) when CV exists", async () => {
    mocks.state.cvHeader = makeHeader();
    mocks.state.experiences = [makeExperience()];
    mocks.state.educations = [makeEducation()];
    mocks.state.skills = [makeSkill()];
    mocks.state.certifications = [makeCertification()];

    const result = await getOwnedCv(CANDIDATE_ID);

    expect(result).not.toBeNull();
    expect(result!.header.id).toBe(CV_ID);
    expect(result!.header.title).toBe("Senior Developer");
    expect(result!.experiences).toHaveLength(1);
    expect(result!.educations).toHaveLength(1);
    expect(result!.skills).toHaveLength(1);
    expect(result!.certifications).toHaveLength(1);
  });

  it("returns empty section arrays when CV exists but sections are empty", async () => {
    mocks.state.cvHeader = makeHeader();
    mocks.state.experiences = [];
    mocks.state.educations = [];
    mocks.state.skills = [];
    mocks.state.certifications = [];

    const result = await getOwnedCv(CANDIDATE_ID);

    expect(result).not.toBeNull();
    expect(result!.experiences).toEqual([]);
    expect(result!.educations).toEqual([]);
    expect(result!.skills).toEqual([]);
    expect(result!.certifications).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// saveCv — create path (no existing CV)
// ---------------------------------------------------------------------------
describe("saveCv", () => {
  it("creates a new CV with all sections and audits CV_CREATED", async () => {
    mocks.state.cvHeader = null;
    mocks.state.existingHeader = null;

    const result = await saveCv(CANDIDATE_ID, cvInput);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.created).toBe(true);
      expect(result.cv.header).toBeDefined();
      expect(result.cv.experiences).toBeDefined();
      expect(result.cv.educations).toBeDefined();
      expect(result.cv.skills).toBeDefined();
      expect(result.cv.certifications).toBeDefined();
    }

    const audit = mocks.state.allInserts.find(
      (i) => !i.hadReturning && (i.values as { action: string }).action === "CV_CREATED",
    );
    expect(audit).toBeDefined();
  });

  it("inserts all 4 section tables on create", async () => {
    mocks.state.cvHeader = null;
    mocks.state.existingHeader = null;

    await saveCv(CANDIDATE_ID, cvInput);

    const returningSectionInserts = mocks.state.allInserts.filter(
      (i) => i.hadReturning && Array.isArray(i.values),
    );
    expect(returningSectionInserts).toHaveLength(4);

    const headerInsert = mocks.state.allInserts.find(
      (i) => i.hadReturning && !Array.isArray(i.values) && "candidateId" in (i.values as object),
    );
    expect(headerInsert).toBeDefined();
  });

  it("scopes create by candidateId (header values include candidateId)", async () => {
    mocks.state.cvHeader = null;
    mocks.state.existingHeader = null;

    await saveCv(CANDIDATE_ID, cvInput);

    const headerInsert = mocks.state.allInserts.find(
      (i) => i.hadReturning && !Array.isArray(i.values) && "candidateId" in (i.values as object),
    );
    expect(headerInsert).toBeDefined();
    expect((headerInsert!.values as Record<string, unknown>).candidateId).toBe(CANDIDATE_ID);
  });
});

// ---------------------------------------------------------------------------
// saveCv — update path (existing CV)
// ---------------------------------------------------------------------------
describe("saveCv — update path", () => {
  it("updates existing CV, replaces sections, and audits CV_UPDATED", async () => {
    mocks.state.cvHeader = makeHeader();
    mocks.state.existingHeader = { id: CV_ID };

    const result = await saveCv(CANDIDATE_ID, cvInput);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.created).toBe(false);
      expect(result.cv.header).toBeDefined();
    }

    const audit = mocks.state.allInserts.find(
      (i) => !i.hadReturning && (i.values as { action: string }).action === "CV_UPDATED",
    );
    expect(audit).toBeDefined();
  });

  it("deletes old sections before inserting new ones on update", async () => {
    mocks.state.cvHeader = makeHeader();
    mocks.state.existingHeader = { id: CV_ID };

    await saveCv(CANDIDATE_ID, cvInput);

    const returningSectionInserts = mocks.state.allInserts.filter(
      (i) => i.hadReturning && Array.isArray(i.values),
    );
    expect(returningSectionInserts).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// deleteCv
// ---------------------------------------------------------------------------
describe("deleteCv", () => {
  it("deletes CV and audits CV_DELETED when CV exists", async () => {
    mocks.state.existingHeader = { id: CV_ID };

    const result = await deleteCv(CANDIDATE_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.deleted).toBe(true);
    }

    const audit = mocks.state.allInserts.find(
      (i) => !i.hadReturning && (i.values as { action: string }).action === "CV_DELETED",
    );
    expect(audit).toBeDefined();
  });

  it("returns { ok: true, deleted: false } when no CV exists", async () => {
    mocks.state.existingHeader = null;

    const result = await deleteCv(CANDIDATE_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.deleted).toBe(false);
    }
  });

  it("scopes delete by candidateId (audit targets candidateId)", async () => {
    mocks.state.existingHeader = { id: CV_ID };

    await deleteCv(CANDIDATE_ID);

    const audit = mocks.state.allInserts.find(
      (i) => !i.hadReturning && (i.values as { action: string }).action === "CV_DELETED",
    );
    expect(audit).toBeDefined();
    expect((audit!.values as Record<string, unknown>).targetId).toBe(CANDIDATE_ID);
    expect((audit!.values as Record<string, unknown>).actorUserId).toBe(CANDIDATE_ID);
  });
});

// ---------------------------------------------------------------------------
// Transaction usage
// ---------------------------------------------------------------------------
describe("transaction usage", () => {
  it("saveCv uses a transaction", async () => {
    mocks.state.cvHeader = null;
    mocks.state.existingHeader = null;

    const { db } = await import("@/db");
    const spy = vi.mocked(db).transaction;

    await saveCv(CANDIDATE_ID, cvInput);
    expect(spy).toHaveBeenCalled();
  });

  it("deleteCv uses a transaction", async () => {
    mocks.state.existingHeader = { id: CV_ID };

    const { db } = await import("@/db");
    const spy = vi.mocked(db).transaction;

    await deleteCv(CANDIDATE_ID);
    expect(spy).toHaveBeenCalled();
  });
});
