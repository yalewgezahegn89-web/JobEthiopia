import { describe, it, expect, vi, beforeEach } from "vitest";
import { users } from "@/db/schema/users";
import { authAccounts } from "@/db/schema/authAccounts";

const mocks = vi.hoisted(() => ({
  findAccount: vi.fn(),
  findUser: vi.fn(),
  transaction: vi.fn(),
  insert: vi.fn(),
  writes: [] as { table: unknown; values: Record<string, unknown> }[],
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      authAccounts: {
        findFirst: (...args: unknown[]) => mocks.findAccount(...args),
      },
      users: {
        findFirst: (...args: unknown[]) => mocks.findUser(...args),
      },
    },
    transaction: (...args: unknown[]) => mocks.transaction(...args),
    insert: (...args: unknown[]) => mocks.insert(...args),
  },
}));

import { authenticateGoogleIdentity } from "../google";

interface InsertOptions {
  failUser?: unknown;
  failAccount?: unknown;
  sink?: { table: unknown; values: Record<string, unknown> }[];
}

function createInsert(table: unknown, options: InsertOptions = {}) {
  return {
    values: (values: Record<string, unknown>) => {
      const resultPromise = (async () => {
        if (table === users) {
          if (options.failUser) throw options.failUser;
        }
        if (table === authAccounts) {
          if (options.failAccount) throw options.failAccount;
        }

        const row =
          table === users
            ? { ...values, id: "new-user-id" }
            : table === authAccounts
              ? { ...values, id: "new-account-id" }
              : { ...values, id: "audit-id" };

        (options.sink ?? mocks.writes).push({ table, values: row });
        return [row];
      })();

      return {
        returning: async () => resultPromise,
        then: (
          onFulfilled?: (value: unknown) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) => resultPromise.then(onFulfilled, onRejected),
        catch: (onRejected: (reason: unknown) => unknown) =>
          resultPromise.catch(onRejected),
      };
    },
  };
}

function makeTransaction(options: InsertOptions = {}) {
  return async (callback: (tx: unknown) => Promise<unknown>) => {
    const localWrites: { table: unknown; values: Record<string, unknown> }[] =
      [];
    const tx = {
      insert: (table: unknown) =>
        createInsert(table, { ...options, sink: localWrites }),
    };
    const result = await callback(tx);
    mocks.writes.push(...localWrites);
    return result;
  };
}

const USER = {
  id: "11111111-1111-4111-8111-111111111111",
  role: "CANDIDATE" as const,
  name: "Existing User",
  email: "existing@example.com",
  isActive: true,
};

const IDENTITY = {
  subject: "google-subject-1",
  email: "  New.User@Example.COM ",
  emailVerified: true,
  name: "New User",
  givenName: "New",
  familyName: "User",
};

function userWrites() {
  return mocks.writes.filter((write) => write.table === users);
}

function accountWrites() {
  return mocks.writes.filter((write) => write.table === authAccounts);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.writes.length = 0;
  mocks.findAccount.mockResolvedValue(undefined);
  mocks.findUser.mockResolvedValue(undefined);
  mocks.transaction.mockImplementation(makeTransaction());
  mocks.insert.mockImplementation((table: unknown) => createInsert(table));
});

describe("authenticateGoogleIdentity", () => {
  it("logs in an existing linked Google identity without changing its role", async () => {
    mocks.findAccount.mockResolvedValue({ userId: USER.id });
    mocks.findUser.mockResolvedValue({ ...USER, role: "ADMIN" });

    const result = await authenticateGoogleIdentity(IDENTITY);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.created).toBe(false);
      expect(result.user.id).toBe(USER.id);
      expect(result.user.role).toBe("ADMIN");
    }
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(userWrites()).toHaveLength(0);
    expect(accountWrites()).toHaveLength(0);
  });

  it("creates a new verified candidate atomically with a Google auth account", async () => {
    const result = await authenticateGoogleIdentity(IDENTITY);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.created).toBe(true);
      expect(result.user.role).toBe("CANDIDATE");
      expect(result.user.email).toBe("new.user@example.com");
    }

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    const [userWrite] = userWrites();
    const [accountWrite] = accountWrites();

    expect(userWrite.values).toMatchObject({
      name: "New User",
      email: "new.user@example.com",
      passwordHash: null,
      role: "CANDIDATE",
      isActive: true,
    });
    expect(userWrite.values.emailVerifiedAt).toBeInstanceOf(Date);
    expect(accountWrite.values).toEqual({
      userId: "new-user-id",
      provider: "google",
      providerAccountId: IDENTITY.subject,
      id: "new-account-id",
    });
  });

  it("never grants a staff role to a new Google user", async () => {
    await authenticateGoogleIdentity({
      ...IDENTITY,
      name: "Would-be Admin",
    });

    const [userWrite] = userWrites();
    expect(userWrite.values.role).toBe("CANDIDATE");
    expect(["SUPER_ADMIN", "ADMIN", "STAFF", "MODERATOR", "ORGANIZATION_ADMIN"])
      .not.toContain(userWrite.values.role);
  });

  it("rejects an existing email collision without linking accounts", async () => {
    mocks.findUser.mockResolvedValue(USER);

    const result = await authenticateGoogleIdentity(IDENTITY);

    expect(result).toEqual({ ok: false, reason: "email_conflict" });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(userWrites()).toHaveLength(0);
    expect(accountWrites()).toHaveLength(0);
  });

  it("rejects a linked account whose user is inactive", async () => {
    mocks.findAccount.mockResolvedValue({ userId: USER.id });
    mocks.findUser.mockResolvedValue({ ...USER, isActive: false });

    await expect(authenticateGoogleIdentity(IDENTITY)).rejects.toThrow(
      "GOOGLE_ACCOUNT_UNAVAILABLE",
    );
  });

  it("rejects an unverified Google email before touching the database", async () => {
    const result = await authenticateGoogleIdentity({
      ...IDENTITY,
      emailVerified: false,
    });

    expect(result).toEqual({ ok: false, reason: "email_not_verified" });
    expect(mocks.findAccount).not.toHaveBeenCalled();
  });

  it("rejects a missing subject or invalid email", async () => {
    await expect(
      authenticateGoogleIdentity({ ...IDENTITY, subject: "  " }),
    ).resolves.toEqual({ ok: false, reason: "invalid_identity" });

    await expect(
      authenticateGoogleIdentity({ ...IDENTITY, email: "not-an-email" }),
    ).resolves.toEqual({ ok: false, reason: "invalid_identity" });
  });

  it("recovers a concurrent duplicate callback through the unique constraint", async () => {
    const uniqueViolation = Object.assign(new Error("duplicate key"), {
      code: "23505",
    });
    mocks.findAccount
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ userId: USER.id });
    mocks.findUser
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(USER);
    mocks.transaction.mockImplementation(
      makeTransaction({ failAccount: uniqueViolation }),
    );

    const result = await authenticateGoogleIdentity(IDENTITY);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.created).toBe(false);
      expect(result.user.id).toBe(USER.id);
    }
    expect(userWrites()).toHaveLength(0);
    expect(accountWrites()).toHaveLength(0);
  });

  it("rolls back the candidate insert when provider-account insertion fails", async () => {
    const failure = Object.assign(new Error("provider insert failed"), {
      code: "XX000",
    });
    mocks.transaction.mockImplementation(
      makeTransaction({ failAccount: failure }),
    );

    await expect(authenticateGoogleIdentity(IDENTITY)).rejects.toThrow(
      "provider insert failed",
    );

    expect(userWrites()).toHaveLength(0);
    expect(accountWrites()).toHaveLength(0);
  });

  it("does not recover a unique email collision as a Google identity", async () => {
    const uniqueViolation = Object.assign(new Error("duplicate email"), {
      code: "23505",
    });
    mocks.findAccount.mockResolvedValue(undefined);
    mocks.findUser.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(
      makeTransaction({ failUser: uniqueViolation }),
    );

    await expect(authenticateGoogleIdentity(IDENTITY)).rejects.toThrow(
      "duplicate email",
    );
    expect(userWrites()).toHaveLength(0);
  });
});
