import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbTransaction: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mocks.mockDbSelect(...args),
    transaction: (...args: unknown[]) => mocks.mockDbTransaction(...args),
  },
}));

import {
  resolveEmployerApplicationOrganization,
  assertEmployerApplicationNoteAccess,
  listApplicationNotes,
  createApplicationNote,
  updateApplicationNote,
  deleteApplicationNote,
} from "../applicationNotes";

const ACTOR = "11111111-1111-4111-8111-111111111111";
const ACTOR2 = "22222222-2222-4222-8222-222222222222";
const ORG_A = "33333333-3333-4333-8333-333333333333";
const JOB_A = "55555555-5555-4555-8555-555555555555";
const APP_A = "66666666-6666-4666-8666-666666666666";
const APP_B = "77777777-7777-4777-8777-777777777777";
const NOTE_1 = "88888888-8888-4888-8888-888888888888";
const NOTE_2 = "99999999-9999-4999-8999-999999999999";

const ORG_ADMIN = "ORGANIZATION_ADMIN";

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: NOTE_1,
    applicationId: APP_A,
    authorUserId: ACTOR,
    authorName: "Alice",
    authorActive: true,
    body: "Strong candidate",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

/**
 * Builds a db.select() query-builder chain. Terminal (limit or orderBy) resolves
 * to `result`. Intermediate methods return the chain itself.
 */
function selectChain(result: unknown[]) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.leftJoin = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue(result);
  return chain;
}

/**
 * Queues the three db.select() calls made by assertEmployerApplicationNoteAccess:
 * actor, application->org resolution, membership.
 */
function setupAccess({
  actor = [{ role: ORG_ADMIN, isActive: true }],
  appOrg = [{ applicationId: APP_A, jobId: JOB_A, organizationId: ORG_A, organizationStatus: "ACTIVE" }],
  membership = [{ id: "m1" }],
  orgStatus = "ACTIVE",
} = {}) {
  mocks.mockDbSelect.mockReset();
  mocks.mockDbSelect
    .mockReturnValueOnce(selectChain(actor))
    .mockReturnValueOnce(
      selectChain(
        appOrg.map((r) => ({ ...r, organizationStatus: orgStatus })),
      ),
    )
    .mockReturnValueOnce(selectChain(membership));
}

type Tx = {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

function buildTx(): Tx {
  return { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("resolveEmployerApplicationOrganization", () => {
  it("returns the derived organization context", async () => {
    mocks.mockDbSelect.mockReturnValue(selectChain([
      { applicationId: APP_A, jobId: JOB_A, organizationId: ORG_A, organizationStatus: "ACTIVE" },
    ]));
    const result = await resolveEmployerApplicationOrganization(APP_A);
    expect(result).toEqual({
      applicationId: APP_A,
      jobId: JOB_A,
      organizationId: ORG_A,
      organizationStatus: "ACTIVE",
    });
  });

  it("returns null when the application is missing", async () => {
    mocks.mockDbSelect.mockReturnValue(selectChain([]));
    const result = await resolveEmployerApplicationOrganization(APP_A);
    expect(result).toBeNull();
  });
});

describe("assertEmployerApplicationNoteAccess", () => {
  it("allows an active org admin member", async () => {
    setupAccess();
    const result = await assertEmployerApplicationNoteAccess(ACTOR, APP_A);
    expect(result).toEqual({ ok: true, organizationId: ORG_A });
  });

  it("denies a missing actor", async () => {
    setupAccess({ actor: [] });
    const result = await assertEmployerApplicationNoteAccess(ACTOR, APP_A);
    expect(result).toEqual({ ok: false, code: "EMPLOYER_NOT_AUTHORIZED" });
  });

  it("denies an inactive actor", async () => {
    setupAccess({ actor: [{ role: ORG_ADMIN, isActive: false }] });
    const result = await assertEmployerApplicationNoteAccess(ACTOR, APP_A);
    expect(result).toEqual({ ok: false, code: "EMPLOYER_NOT_AUTHORIZED" });
  });

  it("denies a non-org-admin actor", async () => {
    setupAccess({ actor: [{ role: "CANDIDATE", isActive: true }] });
    const result = await assertEmployerApplicationNoteAccess(ACTOR, APP_A);
    expect(result).toEqual({ ok: false, code: "EMPLOYER_NOT_AUTHORIZED" });
  });

  it("denies a missing application (covers cross-org too)", async () => {
    setupAccess({ appOrg: [] });
    const result = await assertEmployerApplicationNoteAccess(ACTOR, APP_A);
    expect(result).toEqual({ ok: false, code: "APPLICATION_NOT_FOUND" });
  });

  it("denies an inactive organization", async () => {
    setupAccess({ orgStatus: "INACTIVE" });
    const result = await assertEmployerApplicationNoteAccess(ACTOR, APP_A);
    expect(result).toEqual({ ok: false, code: "ORGANIZATION_INACTIVE" });
  });

  it("denies a non-member of the organization", async () => {
    setupAccess({ membership: [] });
    const result = await assertEmployerApplicationNoteAccess(ACTOR, APP_A);
    expect(result).toEqual({ ok: false, code: "EMPLOYER_NOT_AUTHORIZED" });
  });
});

describe("listApplicationNotes", () => {
  it("returns notes newest-first with author fields only", async () => {
    setupAccess();
    mocks.mockDbSelect.mockReturnValueOnce(
      selectChain([
        makeRow(),
        makeRow({ id: NOTE_2, authorUserId: null, authorName: null, authorActive: null, createdAt: new Date("2026-01-02T00:00:00.000Z") }),
      ]),
    );
    const result = await listApplicationNotes(ACTOR, APP_A);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.item).toHaveLength(2);
      const first = result.item[0];
      expect(first).toMatchObject({
        id: NOTE_1,
        authorUserId: ACTOR,
        authorName: "Alice",
        authorActive: true,
        body: "Strong candidate",
      });
      expect(first).not.toHaveProperty("candidateUserId");
      expect(first).not.toHaveProperty("email");
    }
  });

  it("denies cross-org access", async () => {
    setupAccess({ appOrg: [] });
    const result = await listApplicationNotes(ACTOR, APP_B);
    expect(result).toEqual({ ok: false, code: "APPLICATION_NOT_FOUND" });
  });

  it("denies an inactive organization", async () => {
    setupAccess({ orgStatus: "INACTIVE" });
    const result = await listApplicationNotes(ACTOR, APP_A);
    expect(result).toEqual({ ok: false, code: "ORGANIZATION_INACTIVE" });
  });

  it("denies an inactive actor", async () => {
    setupAccess({ actor: [{ role: ORG_ADMIN, isActive: false }] });
    const result = await listApplicationNotes(ACTOR, APP_A);
    expect(result).toEqual({ ok: false, code: "EMPLOYER_NOT_AUTHORIZED" });
  });

  it("denies a candidate actor", async () => {
    setupAccess({ actor: [{ role: "CANDIDATE", isActive: true }] });
    const result = await listApplicationNotes(ACTOR, APP_A);
    expect(result).toEqual({ ok: false, code: "EMPLOYER_NOT_AUTHORIZED" });
  });

  it("denies a staff actor", async () => {
    setupAccess({ actor: [{ role: "SUPER_ADMIN", isActive: true }] });
    const result = await listApplicationNotes(ACTOR, APP_A);
    expect(result).toEqual({ ok: false, code: "EMPLOYER_NOT_AUTHORIZED" });
  });
});

describe("createApplicationNote", () => {
  it("inserts note + audit, derives author from session", async () => {
    setupAccess();
    const tx = buildTx();
    const created = makeRow();
    mocks.mockDbTransaction.mockImplementationOnce(async (cb: (t: Tx) => unknown) =>
      cb(tx),
    );
    const noteValues: Record<string, unknown>[] = [];
    tx.insert
      .mockImplementationOnce(() => ({
        values: (v: Record<string, unknown>) => {
          noteValues.push(v);
          return { returning: () => Promise.resolve([created]) };
        },
      }))
      .mockImplementationOnce(() => ({
        values: () => Promise.resolve(),
      }));

    const result = await createApplicationNote(ACTOR, APP_A, "Great profile");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.item.body).toBe("Strong candidate");
    }
    // author is always derived from the session, never from a client payload
    expect(noteValues[0].authorUserId).toBe(ACTOR);
    expect(noteValues[0].applicationId).toBe(APP_A);
    // no candidate/organization fields are stored on a note
    expect(noteValues[0]).not.toHaveProperty("candidateUserId");
    expect(noteValues[0]).not.toHaveProperty("organizationId");
  });

  it("returns failure when access is denied", async () => {
    setupAccess({ appOrg: [] });
    const result = await createApplicationNote(ACTOR, APP_A, "x");
    expect(result).toEqual({ ok: false, code: "APPLICATION_NOT_FOUND" });
    expect(mocks.mockDbTransaction).not.toHaveBeenCalled();
  });
});

describe("updateApplicationNote", () => {
  it("updates the actor's own note", async () => {
    setupAccess();
    const tx = buildTx();
    mocks.mockDbTransaction.mockImplementationOnce(async (cb: (t: Tx) => unknown) =>
      cb(tx),
    );
    tx.select.mockReturnValue(
      selectChain([{ id: NOTE_1, applicationId: APP_A, authorUserId: ACTOR }]),
    );
    tx.update.mockReturnValue({
      set: () => ({
        where: () => ({
          returning: () =>
            Promise.resolve([
              makeRow({ body: "Updated body", updatedAt: new Date("2026-02-01T00:00:00.000Z") }),
            ]),
        }),
      }),
    });
    const auditRows: Record<string, unknown>[] = [];
    tx.insert.mockImplementationOnce(() => ({
      values: (v: Record<string, unknown>) => {
        auditRows.push(v);
        return Promise.resolve();
      },
    }));

    const result = await updateApplicationNote(ACTOR, APP_A, NOTE_1, "Updated body");
    expect(result.ok).toBe(true);

    // audit event
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0].action).toBe("APPLICATION_NOTE_UPDATED");
    expect(auditRows[0].targetType).toBe("application_note");
    expect(auditRows[0].metadata).toEqual({ applicationId: APP_A, noteId: NOTE_1 });
    expect(auditRows[0].metadata).not.toHaveProperty("body");
    expect(auditRows[0].metadata).not.toHaveProperty("email");
  });

  it("denies updating another author's note", async () => {
    setupAccess();
    const tx = buildTx();
    mocks.mockDbTransaction.mockImplementationOnce(async (cb: (t: Tx) => unknown) =>
      cb(tx),
    );
    tx.select.mockReturnValue(
      selectChain([{ id: NOTE_1, applicationId: APP_A, authorUserId: ACTOR2 }]),
    );
    const result = await updateApplicationNote(ACTOR, APP_A, NOTE_1, "Hijack");
    expect(result).toEqual({ ok: false, code: "NOTE_NOT_OWNED" });
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("returns NOTE_NOT_FOUND for a missing note", async () => {
    setupAccess();
    const tx = buildTx();
    mocks.mockDbTransaction.mockImplementationOnce(async (cb: (t: Tx) => unknown) =>
      cb(tx),
    );
    tx.select.mockReturnValue(selectChain([]));
    const result = await updateApplicationNote(ACTOR, APP_A, NOTE_1, "x");
    expect(result).toEqual({ ok: false, code: "NOTE_NOT_FOUND" });
  });

  it("denies cross-org update", async () => {
    setupAccess({ appOrg: [] });
    const result = await updateApplicationNote(ACTOR, APP_B, NOTE_1, "x");
    expect(result).toEqual({ ok: false, code: "APPLICATION_NOT_FOUND" });
    expect(mocks.mockDbTransaction).not.toHaveBeenCalled();
  });
});

describe("deleteApplicationNote", () => {
  it("deletes the actor's own note + writes audit", async () => {
    setupAccess();
    const tx = buildTx();
    mocks.mockDbTransaction.mockImplementationOnce(async (cb: (t: Tx) => unknown) =>
      cb(tx),
    );
    tx.select.mockReturnValue(
      selectChain([{ id: NOTE_1, applicationId: APP_A, authorUserId: ACTOR }]),
    );
    tx.delete.mockReturnValue({ where: () => Promise.resolve() });
    const auditRows: Record<string, unknown>[] = [];
    tx.insert.mockImplementationOnce(() => ({
      values: (v: Record<string, unknown>) => {
        auditRows.push(v);
        return Promise.resolve();
      },
    }));

    const result = await deleteApplicationNote(ACTOR, APP_A, NOTE_1);
    expect(result).toEqual({ ok: true, removed: true });
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0].action).toBe("APPLICATION_NOTE_DELETED");
    expect(auditRows[0].targetType).toBe("application_note");
    expect(auditRows[0].metadata).toEqual({ applicationId: APP_A, noteId: NOTE_1 });
    expect(auditRows[0].metadata).not.toHaveProperty("body");
    expect(auditRows[0].metadata).not.toHaveProperty("email");
  });

  it("denies deleting another author's note", async () => {
    setupAccess();
    const tx = buildTx();
    mocks.mockDbTransaction.mockImplementationOnce(async (cb: (t: Tx) => unknown) =>
      cb(tx),
    );
    tx.select.mockReturnValue(
      selectChain([{ id: NOTE_1, applicationId: APP_A, authorUserId: ACTOR2 }]),
    );
    const result = await deleteApplicationNote(ACTOR, APP_A, NOTE_1);
    expect(result).toEqual({ ok: false, code: "NOTE_NOT_OWNED" });
    expect(tx.delete).not.toHaveBeenCalled();
  });

  it("denies deleting a missing note", async () => {
    setupAccess();
    const tx = buildTx();
    mocks.mockDbTransaction.mockImplementationOnce(async (cb: (t: Tx) => unknown) =>
      cb(tx),
    );
    tx.select.mockReturnValue(selectChain([]));
    const result = await deleteApplicationNote(ACTOR, APP_A, NOTE_1);
    expect(result).toEqual({ ok: false, code: "NOTE_NOT_FOUND" });
    expect(tx.delete).not.toHaveBeenCalled();
  });

  it("denies cross-org delete", async () => {
    setupAccess({ appOrg: [] });
    const result = await deleteApplicationNote(ACTOR, APP_B, NOTE_1);
    expect(result).toEqual({ ok: false, code: "APPLICATION_NOT_FOUND" });
    expect(mocks.mockDbTransaction).not.toHaveBeenCalled();
  });
});
