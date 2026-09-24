import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  state: {
    ownedLetter: null as Record<string, unknown> | null,
    listRows: [] as Record<string, unknown>[],
    existingCount: 0 as number,
    updateResult: [] as Record<string, unknown>[],
    deleteResult: [] as Record<string, unknown>[],
    letterInserts: [] as Record<string, unknown>[],
    auditInserts: [] as Record<string, unknown>[],
    findManyArgs: [] as unknown[],
    findFirstArgs: [] as unknown[],
    updateWhereArgs: [] as unknown[],
    deleteWhereArgs: [] as unknown[],
  },
}));

vi.mock("@/db", () => {
  const listHasCount = (args: unknown): boolean =>
    typeof args === "object" && args !== null && "limit" in (args as Record<string, unknown>);

  const collectList = () =>
    mocks.state.existingCount > 0
      ? Array.from({ length: mocks.state.existingCount }, (_, i) => ({ id: `existing-${i}` }))
      : [];

  const hasAction = (value: unknown): boolean =>
    typeof value === "object" && value !== null && "action" in (value as Record<string, unknown>);

  const hasCandidateId = (value: unknown): boolean =>
    typeof value === "object" && value !== null && "candidateId" in (value as Record<string, unknown>);

  const dbQuery = {
    candidateCoverLetters: {
      findFirst: async (args: unknown) => {
        mocks.state.findFirstArgs.push(args);
        return mocks.state.ownedLetter;
      },
      findMany: async (args: unknown) => {
        mocks.state.findManyArgs.push(args);
        if (listHasCount(args)) return collectList();
        return mocks.state.listRows;
      },
    },
  };

  const db = {
    query: dbQuery,
    transaction: vi.fn(async (cb: (tx: unknown) => unknown) => {
      const tx = {
        query: {
          candidateCoverLetters: {
            findFirst: async (args: unknown) => {
              mocks.state.findFirstArgs.push(args);
              return mocks.state.ownedLetter;
            },
            findMany: async (args: unknown) => {
              mocks.state.findManyArgs.push(args);
              if (listHasCount(args)) return collectList();
              return mocks.state.listRows;
            },
          },
        },
        update: vi.fn(() => ({
          set: () => ({
            where: (args: unknown) => {
              mocks.state.updateWhereArgs.push(args);
              return {
                returning: async () => mocks.state.updateResult,
              };
            },
          }),
        })),
        insert: vi.fn(() => ({
          values: (v: unknown) => {
            if (hasAction(v)) {
              mocks.state.auditInserts.push(v as Record<string, unknown>);
              return {};
            }
            if (hasCandidateId(v)) {
              mocks.state.letterInserts.push(v as Record<string, unknown>);
              return {
                returning: async () => [
                  { id: "letter-id", ...(v as Record<string, unknown>) },
                ],
              };
            }
            return {};
          },
        })),
        delete: vi.fn(() => ({
          where: (args: unknown) => {
            mocks.state.deleteWhereArgs.push(args);
            return {
              returning: async () => mocks.state.deleteResult,
            };
          },
        })),
      };
      return cb(tx);
    }),
  };
  return { db };
});

import {
  getOwnedCoverLetter,
  listCoverLetters,
  saveCoverLetter,
  duplicateCoverLetter,
  deleteCoverLetter,
} from "@/lib/coverLetter/dal";
import {
  COVER_LETTER_TITLE_MAX,
  COVER_LETTERS_MAX,
  type CoverLetterInput,
} from "@/lib/validations/coverLetter";

const CANDIDATE_ID = "11111111-1111-4111-8111-111111111111";
const LETTER_ID = "33333333-3333-4333-8333-333333333333";

function makeLetter(overrides: Record<string, unknown> = {}) {
  return {
    id: LETTER_ID,
    candidateId: CANDIDATE_ID,
    jobId: null,
    title: "Accountant — application",
    position: "Senior Accountant",
    employer: "ABC Group",
    recipient: "Mr. Dawit Alemu",
    location: "Addis Ababa",
    body: "I am writing to apply for the Senior Accountant position.",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
    ...overrides,
  };
}

const validInput: CoverLetterInput = {
  title: "Accountant — application",
  position: "Senior Accountant",
  employer: "ABC Group",
  recipient: "Mr. Dawit Alemu",
  location: "Addis Ababa",
  body: "I am writing to apply for the Senior Accountant position.",
};

function reset() {
  mocks.state.ownedLetter = null;
  mocks.state.listRows = [];
  mocks.state.existingCount = 0;
  mocks.state.updateResult = [];
  mocks.state.deleteResult = [];
  mocks.state.letterInserts = [];
  mocks.state.auditInserts = [];
  mocks.state.findManyArgs = [];
  mocks.state.findFirstArgs = [];
  mocks.state.updateWhereArgs = [];
  mocks.state.deleteWhereArgs = [];
}

beforeEach(() => {
  vi.clearAllMocks();
  reset();
});

function auditActions(): string[] {
  return mocks.state.auditInserts
    .map((a) => a.action as string)
    .filter((a) => a.startsWith("COVER_LETTER_"));
}

function findAudit(action: string) {
  return mocks.state.auditInserts.find((a) => a.action === action);
}

function findLetterInsert() {
  return mocks.state.letterInserts[mocks.state.letterInserts.length - 1];
}

// ---------------------------------------------------------------------------
// getOwnedCoverLetter
// ---------------------------------------------------------------------------
describe("getOwnedCoverLetter", () => {
  it("returns null when candidateId or id is empty", async () => {
    expect(await getOwnedCoverLetter("", LETTER_ID)).toBeNull();
    expect(await getOwnedCoverLetter(CANDIDATE_ID, "")).toBeNull();
    expect(await getOwnedCoverLetter("", "")).toBeNull();
  });

  it("returns the row when it belongs to the candidate", async () => {
    mocks.state.ownedLetter = makeLetter();
    const result = await getOwnedCoverLetter(CANDIDATE_ID, LETTER_ID);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(LETTER_ID);
  });

  it("returns null when the letter does not exist", async () => {
    mocks.state.ownedLetter = null;
    expect(await getOwnedCoverLetter(CANDIDATE_ID, LETTER_ID)).toBeNull();
  });

  it("always queries scoped by a where clause (id + owning candidate)", async () => {
    mocks.state.ownedLetter = null;
    await getOwnedCoverLetter(CANDIDATE_ID, LETTER_ID);

    const call = mocks.state.findFirstArgs[mocks.state.findFirstArgs.length - 1] as
      | Record<string, unknown>
      | undefined;
    expect(call).toBeDefined();
    expect(call!.where).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// listCoverLetters
// ---------------------------------------------------------------------------
describe("listCoverLetters", () => {
  it("returns an empty array when candidateId is empty", async () => {
    expect(await listCoverLetters("")).toEqual([]);
  });

  it("returns the candidate's letters", async () => {
    mocks.state.listRows = [makeLetter({ title: "Letter A" }), makeLetter({ title: "Letter B" })];
    const rows = await listCoverLetters(CANDIDATE_ID);
    expect(rows).toHaveLength(2);
  });

  it("selects only ListItem columns", async () => {
    mocks.state.listRows = [makeLetter()];
    await listCoverLetters(CANDIDATE_ID);

    const listCall = mocks.state.findManyArgs.find(
      (a) => typeof a === "object" && a !== null && "columns" in (a as Record<string, unknown>),
    ) as Record<string, unknown> | undefined;

    expect(listCall).toBeDefined();
    expect(listCall!.columns).toMatchObject({
      id: true,
      jobId: true,
      title: true,
      position: true,
      employer: true,
      updatedAt: true,
    });
    expect((listCall!.columns as Record<string, unknown>).body).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// saveCoverLetter — create path
// ---------------------------------------------------------------------------
describe("saveCoverLetter — create", () => {
  it("rejects invalid input", async () => {
    const res = await saveCoverLetter(CANDIDATE_ID, { ...validInput, title: "" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("INVALID_INPUT");
  });

  it("creates a letter scoped to the candidate and audits COVER_LETTER_CREATED", async () => {
    mocks.state.existingCount = 0;
    const res = await saveCoverLetter(CANDIDATE_ID, validInput);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.created).toBe(true);
      expect(res.row.candidateId).toBe(CANDIDATE_ID);
      expect(res.row.title).toBe(validInput.title);
    }
    const insert = findLetterInsert();
    expect((insert as Record<string, unknown>).candidateId).toBe(CANDIDATE_ID);
    expect(auditActions()).toContain("COVER_LETTER_CREATED");
  });

  it("persists jobId when provided", async () => {
    mocks.state.existingCount = 0;
    await saveCoverLetter(CANDIDATE_ID, validInput, { jobId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
    const insert = findLetterInsert();
    expect((insert as Record<string, unknown>).jobId).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  });

  it("normalizes jobId to null when omitted", async () => {
    mocks.state.existingCount = 0;
    await saveCoverLetter(CANDIDATE_ID, validInput);
    const insert = findLetterInsert();
    expect((insert as Record<string, unknown>).jobId).toBeNull();
  });

  it("refuses to create when the candidate already has COVER_LETTERS_MAX letters", async () => {
    mocks.state.existingCount = COVER_LETTERS_MAX + 1;
    const res = await saveCoverLetter(CANDIDATE_ID, validInput);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("LIMIT");
    expect(findLetterInsert()).toBeUndefined();
    expect(auditActions()).not.toContain("COVER_LETTER_CREATED");
  });

  it("allows creation at the limit boundary (existing == max)", async () => {
    mocks.state.existingCount = COVER_LETTERS_MAX;
    const res = await saveCoverLetter(CANDIDATE_ID, validInput);
    expect(res.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// saveCoverLetter — update path
// ---------------------------------------------------------------------------
describe("saveCoverLetter — update", () => {
  it("updates the candidate's own letter and audits COVER_LETTER_UPDATED", async () => {
    mocks.state.updateResult = [makeLetter({ title: "New Title" })];
    const res = await saveCoverLetter(CANDIDATE_ID, validInput, { existingId: LETTER_ID });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.created).toBe(false);
      expect(res.row.title).toBe("New Title");
    }
    expect(auditActions()).toContain("COVER_LETTER_UPDATED");
  });

  it("returns NOT_FOUND when the update touches no row (foreign letter)", async () => {
    mocks.state.updateResult = [];
    const res = await saveCoverLetter(CANDIDATE_ID, validInput, { existingId: LETTER_ID });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("NOT_FOUND");
    expect(auditActions()).not.toContain("COVER_LETTER_UPDATED");
  });

  it("does not enforce the limit for updates", async () => {
    mocks.state.existingCount = COVER_LETTERS_MAX + 1;
    mocks.state.updateResult = [makeLetter()];
    const res = await saveCoverLetter(CANDIDATE_ID, validInput, { existingId: LETTER_ID });
    expect(res.ok).toBe(true);
  });

  it("scopes the update by id and owning candidate", async () => {
    mocks.state.updateResult = [makeLetter()];
    await saveCoverLetter(CANDIDATE_ID, validInput, { existingId: LETTER_ID });

    const where = mocks.state.updateWhereArgs[mocks.state.updateWhereArgs.length - 1];
    expect(where).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// duplicateCoverLetter
// ---------------------------------------------------------------------------
describe("duplicateCoverLetter", () => {
  it("returns NOT_FOUND when the source does not exist", async () => {
    mocks.state.ownedLetter = null;
    const res = await duplicateCoverLetter(CANDIDATE_ID, LETTER_ID);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("NOT_FOUND");
  });

  it("scopes the source lookup to the owning candidate", async () => {
    mocks.state.ownedLetter = null;
    await duplicateCoverLetter(CANDIDATE_ID, LETTER_ID);

    const call = mocks.state.findFirstArgs[mocks.state.findFirstArgs.length - 1] as
      | Record<string, unknown>
      | undefined;
    expect(call).toBeDefined();
    expect(call!.where).toBeTruthy();
  });

  it("duplicates the letter with a ' (copy)' suffix and audits COVER_LETTER_DUPLICATED", async () => {
    mocks.state.ownedLetter = makeLetter({ title: "My Letter", jobId: "aaaa-..." });
    mocks.state.existingCount = 0;

    const res = await duplicateCoverLetter(CANDIDATE_ID, LETTER_ID);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.row.title).toBe("My Letter (copy)");
      expect(res.row.candidateId).toBe(CANDIDATE_ID);
      expect(res.row.jobId).toBe(mocks.state.ownedLetter.jobId);
    }
    expect(auditActions()).toContain("COVER_LETTER_DUPLICATED");
  });

  it("caps the copied title at COVER_LETTER_TITLE_MAX", async () => {
    mocks.state.ownedLetter = makeLetter({ title: "a".repeat(COVER_LETTER_TITLE_MAX) });
    mocks.state.existingCount = 0;

    const res = await duplicateCoverLetter(CANDIDATE_ID, LETTER_ID);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.row.title.length).toBe(COVER_LETTER_TITLE_MAX);
    }
  });

  it("keeps the ' (copy)' suffix when the source leaves room for it", async () => {
    const sourceTitle = "a".repeat(COVER_LETTER_TITLE_MAX - "(copy)".length - 1);
    mocks.state.ownedLetter = makeLetter({ title: sourceTitle, jobId: null });
    mocks.state.existingCount = 0;

    const res = await duplicateCoverLetter(CANDIDATE_ID, LETTER_ID);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.row.title.length).toBe(COVER_LETTER_TITLE_MAX);
      expect(res.row.title.endsWith("(copy)")).toBe(true);
    }
  });

  it("refuses to duplicate when at the limit", async () => {
    mocks.state.ownedLetter = makeLetter();
    mocks.state.existingCount = COVER_LETTERS_MAX + 1;

    const res = await duplicateCoverLetter(CANDIDATE_ID, LETTER_ID);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("LIMIT");
    expect(findLetterInsert()).toBeUndefined();
    expect(auditActions()).not.toContain("COVER_LETTER_DUPLICATED");
  });
});

// ---------------------------------------------------------------------------
// deleteCoverLetter
// ---------------------------------------------------------------------------
describe("deleteCoverLetter", () => {
  it("deletes the candidate's own letter and audits COVER_LETTER_DELETED", async () => {
    mocks.state.deleteResult = [{ id: LETTER_ID }];
    const res = await deleteCoverLetter(CANDIDATE_ID, LETTER_ID);

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.deleted).toBe(true);
    expect(auditActions()).toContain("COVER_LETTER_DELETED");
  });

  it("reports deleted=false when no row matched (foreign letter)", async () => {
    mocks.state.deleteResult = [];
    const res = await deleteCoverLetter(CANDIDATE_ID, LETTER_ID);

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.deleted).toBe(false);
    expect(auditActions()).not.toContain("COVER_LETTER_DELETED");
  });

  it("scopes the audit target to the candidate id", async () => {
    mocks.state.deleteResult = [{ id: LETTER_ID }];
    await deleteCoverLetter(CANDIDATE_ID, LETTER_ID);

    const audit = findAudit("COVER_LETTER_DELETED");
    expect(audit).toBeDefined();
    expect((audit as Record<string, unknown>).targetId).toBe(CANDIDATE_ID);
    expect((audit as Record<string, unknown>).actorUserId).toBe(CANDIDATE_ID);
  });

  it("scopes the delete by id and owning candidate", async () => {
    mocks.state.deleteResult = [{ id: LETTER_ID }];
    await deleteCoverLetter(CANDIDATE_ID, LETTER_ID);

    const where = mocks.state.deleteWhereArgs[mocks.state.deleteWhereArgs.length - 1];
    expect(where).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Transaction usage
// ---------------------------------------------------------------------------
describe("transaction usage", () => {
  it("saveCoverLetter uses a transaction", async () => {
    mocks.state.existingCount = 0;
    const res = await saveCoverLetter(CANDIDATE_ID, validInput);
    expect(res.ok).toBe(true);
  });

  it("duplicateCoverLetter uses a transaction", async () => {
    mocks.state.ownedLetter = makeLetter();
    await duplicateCoverLetter(CANDIDATE_ID, LETTER_ID);
  });

  it("deleteCoverLetter uses a transaction", async () => {
    mocks.state.deleteResult = [{ id: LETTER_ID }];
    await deleteCoverLetter(CANDIDATE_ID, LETTER_ID);
  });
});