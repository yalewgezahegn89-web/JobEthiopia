import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  state: {
    appResume: null as unknown,
    ownedApp: null as unknown,
    insertedResume: null as unknown,
    updatedResume: null as unknown,
    selectQueue: [] as unknown[][],
    allInserts: [] as { values: unknown; hadReturning: boolean }[],
  },
}));

function selectChain(result: unknown[]) {
  const chain = {
    from() {
      return chain;
    },
    innerJoin() {
      return chain;
    },
    leftJoin() {
      return chain;
    },
    where() {
      return chain;
    },
    limit() {
      return Promise.resolve(result);
    },
  };
  return chain;
}

vi.mock("@/db", () => {
  const dbQuery = {
    applicationResumes: {
      findFirst: async () => mocks.state.appResume,
    },
    applications: {
      findFirst: async () => mocks.state.ownedApp,
    },
  };

  const db = {
    query: dbQuery,
    select: vi.fn(() => {
      const result = mocks.state.selectQueue.shift() ?? [];
      return selectChain(result);
    }),
    transaction: async (cb: (tx: unknown) => unknown) => cb(db),
    insert: () => ({
      values: (v: unknown) => {
        const rec = { values: v, hadReturning: false };
        mocks.state.allInserts.push(rec);
        return {
          returning: async () => {
            rec.hadReturning = true;
            return mocks.state.insertedResume ? [mocks.state.insertedResume] : [];
          },
        };
      },
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          returning: async () =>
            mocks.state.updatedResume ? [mocks.state.updatedResume] : [],
        }),
      }),
    }),
    delete: () => ({
      where: async () => ({}),
    }),
  };
  return { db };
});

import {
  getApplicationResume,
  getOwnedCandidateResume,
  getEmployerApplicationResume,
  upsertApplicationResume,
  deleteApplicationResume,
} from "../dal";

const APP_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const ORG_ID = "22222222-2222-4222-8222-222222222222";

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "99999999-9999-4999-8999-999999999999",
    applicationId: APP_ID,
    objectKey: "resumes/new.pdf",
    originalName: "cv.pdf",
    mimeType: "application/pdf",
    size: 2048,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function authRow(overrides: Record<string, unknown> = {}) {
  return {
    role: "ORGANIZATION_ADMIN",
    userActive: true,
    orgStatus: "ACTIVE",
    memberId: "mem-1",
    ...overrides,
  };
}

function reset() {
  mocks.state.appResume = null;
  mocks.state.ownedApp = null;
  mocks.state.insertedResume = null;
  mocks.state.updatedResume = null;
  mocks.state.selectQueue = [];
  mocks.state.allInserts = [];
}

beforeEach(() => {
  vi.clearAllMocks();
  reset();
});

describe("getApplicationResume", () => {
  it("returns the resume row for the application", async () => {
    mocks.state.appResume = row();
    const result = await getApplicationResume(APP_ID);
    expect(result?.objectKey).toBe("resumes/new.pdf");
  });

  it("returns null when no resume exists", async () => {
    const result = await getApplicationResume(APP_ID);
    expect(result).toBeNull();
  });
});

describe("getOwnedCandidateResume", () => {
  it("returns the resume when the application belongs to the candidate", async () => {
    mocks.state.ownedApp = { id: APP_ID };
    mocks.state.appResume = row();
    const result = await getOwnedCandidateResume(APP_ID, USER_ID);
    expect(result?.objectKey).toBe("resumes/new.pdf");
  });

  it("returns null when the application is not owned by the candidate", async () => {
    mocks.state.ownedApp = null;
    mocks.state.appResume = row();
    const result = await getOwnedCandidateResume(APP_ID, USER_ID);
    expect(result).toBeNull();
  });
});

describe("getEmployerApplicationResume", () => {
  it("returns the resume for an authorized active org admin", async () => {
    mocks.state.selectQueue.push([
      { ...row(), organizationId: ORG_ID },
    ]);
    mocks.state.selectQueue.push([authRow()]);
    const result = await getEmployerApplicationResume(APP_ID, USER_ID);
    expect(result?.objectKey).toBe("resumes/new.pdf");
  });

  it("returns null when the resume does not exist", async () => {
    mocks.state.selectQueue.push([]);
    const result = await getEmployerApplicationResume(APP_ID, USER_ID);
    expect(result).toBeNull();
  });

  it("denies a non-ORG_ADMIN role", async () => {
    mocks.state.selectQueue.push([{ ...row(), organizationId: ORG_ID }]);
    mocks.state.selectQueue.push([authRow({ role: "CANDIDATE" })]);
    const result = await getEmployerApplicationResume(APP_ID, USER_ID);
    expect(result).toBeNull();
  });

  it("denies an inactive admin", async () => {
    mocks.state.selectQueue.push([{ ...row(), organizationId: ORG_ID }]);
    mocks.state.selectQueue.push([authRow({ userActive: false })]);
    const result = await getEmployerApplicationResume(APP_ID, USER_ID);
    expect(result).toBeNull();
  });

  it("denies when the organization is not active", async () => {
    mocks.state.selectQueue.push([{ ...row(), organizationId: ORG_ID }]);
    mocks.state.selectQueue.push([authRow({ orgStatus: "INACTIVE" })]);
    const result = await getEmployerApplicationResume(APP_ID, USER_ID);
    expect(result).toBeNull();
  });

  it("denies when the admin is not an org member", async () => {
    mocks.state.selectQueue.push([{ ...row(), organizationId: ORG_ID }]);
    mocks.state.selectQueue.push([authRow({ memberId: null })]);
    const result = await getEmployerApplicationResume(APP_ID, USER_ID);
    expect(result).toBeNull();
  });
});

describe("upsertApplicationResume", () => {
  const input = {
    applicationId: APP_ID,
    candidateUserId: USER_ID,
    objectKey: "resumes/new.pdf",
    originalName: "cv.pdf",
    mimeType: "application/pdf",
    size: 2048,
  };

  it("inserts a new row and audits RESUME_UPLOADED", async () => {
    mocks.state.appResume = null;
    mocks.state.insertedResume = row();
    const result = await upsertApplicationResume(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.isReplacement).toBe(false);
      expect(result.previousObjectKey).toBeNull();
      expect(result.auditAction).toBe("uploaded");
    }
    const audits = mocks.state.allInserts.filter((i) => !i.hadReturning);
    expect(audits.map((i) => (i.values as { action: string }).action)).toContain(
      "RESUME_UPLOADED",
    );
  });

  it("updates an existing row, returns the previous key, and audits REPLACED", async () => {
    mocks.state.appResume = { ...row(), objectKey: "resumes/old.pdf" };
    mocks.state.updatedResume = row();
    const result = await upsertApplicationResume(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.isReplacement).toBe(true);
      expect(result.previousObjectKey).toBe("resumes/old.pdf");
      expect(result.auditAction).toBe("replaced");
    }
    const audits = mocks.state.allInserts.filter((i) => !i.hadReturning);
    expect(audits.map((i) => (i.values as { action: string }).action)).toContain(
      "RESUME_REPLACED",
    );
  });
});

describe("deleteApplicationResume", () => {
  it("deletes the row, audits RESUME_DELETED, and returns the object key", async () => {
    mocks.state.appResume = { id: "r1", objectKey: "resumes/del.pdf" };
    const result = await deleteApplicationResume(APP_ID, USER_ID);
    expect(result?.objectKey).toBe("resumes/del.pdf");
    const audits = mocks.state.allInserts.filter((i) => !i.hadReturning);
    expect(audits.map((i) => (i.values as { action: string }).action)).toContain(
      "RESUME_DELETED",
    );
  });

  it("returns null when no resume exists", async () => {
    mocks.state.appResume = null;
    const result = await deleteApplicationResume(APP_ID, USER_ID);
    expect(result).toBeNull();
  });
});
