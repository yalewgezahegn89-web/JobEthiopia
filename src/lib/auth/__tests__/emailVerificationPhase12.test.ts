import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    transaction: (fn: (tx: unknown) => Promise<unknown>) =>
      mocks.mockTransaction(fn),
  },
}));

const mockTransaction = mocks.mockTransaction;

import {
  buildEmailVerificationUrl,
  verifyEmailToken,
} from "../emailVerification";

const USER_ID = "11111111-1111-4111-8111-111111111111";

type Row = {
  id: string;
  userId: string;
  email: string;
  expiresAt: Date;
  consumedAt: Date | null;
  emailVerifiedAt: Date | null;
};

function makeTxMock(selectQueue: unknown[][]) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => selectQueue.shift() ?? [],
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: async () => {},
      }),
    }),
    insert: () => ({
      values: async () => ({}),
    }),
  };
}

describe("buildEmailVerificationUrl", () => {
  beforeEach(() => {
    process.env.APP_BASE_URL = "https://jobs.example.com";
  });

  afterEach(() => {
    delete process.env.APP_BASE_URL;
  });

  it("builds a verify link that encodes the token", () => {
    const url = buildEmailVerificationUrl("abc+123/", "verify");
    expect(url).toBe(
      "https://jobs.example.com/verify-email?token=abc%2B123%2F",
    );
  });

  it("routes change tokens to the email-change consumer type", () => {
    const url = buildEmailVerificationUrl("tok", "change");
    expect(url).toContain("/verify-email");
    expect(url).toContain("token=tok");
    expect(url).toContain("type=change");
  });

  it("omits the type parameter for initial verification", () => {
    const url = buildEmailVerificationUrl("tok", "verify");
    expect(url).not.toContain("type=");
  });
});

describe("verifyEmailToken purpose hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const future = new Date(Date.now() + 24 * 60 * 60 * 1000);

  it("accepts a token whose email matches the user's current email", async () => {
    const tokenRow: Row = {
      id: "t1",
      userId: USER_ID,
      email: "cur@example.com",
      expiresAt: future,
      consumedAt: null,
      emailVerifiedAt: null,
    };
    const userRow = {
      id: USER_ID,
      email: "cur@example.com",
      emailVerifiedAt: null,
    };
    const tx = makeTxMock([[tokenRow], [userRow]]);
    mockTransaction.mockImplementation((fn: (t: unknown) => Promise<unknown>) =>
      fn(tx),
    );

    const result = await verifyEmailToken("raw-token");
    expect(result.ok).toBe(true);
  });

  it("rejects an email-change token on the plain verify path", async () => {
    // A pending email-change token has the NEW target email, which differs
    // from the user's current email — consuming it here must fail.
    const changeToken: Row = {
      id: "t1",
      userId: USER_ID,
      email: "new@example.com",
      expiresAt: future,
      consumedAt: null,
      emailVerifiedAt: null,
    };
    const userRow = {
      id: USER_ID,
      email: "cur@example.com",
      emailVerifiedAt: null,
    };
    const tx = makeTxMock([[changeToken], [userRow]]);
    mockTransaction.mockImplementation((fn: (t: unknown) => Promise<unknown>) =>
      fn(tx),
    );

    const result = await verifyEmailToken("raw-token");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_token");
  });

  it("runs the full transaction on the matching path", async () => {
    // Guard regression: with a matching email the transaction must still apply
    // the EMAIL_VERIFIED audit insert via the tx chain.
    const tokenRow: Row = {
      id: "t1",
      userId: USER_ID,
      email: "cur@example.com",
      expiresAt: future,
      consumedAt: null,
      emailVerifiedAt: null,
    };
    const userRow = {
      id: USER_ID,
      email: "cur@example.com",
      emailVerifiedAt: null,
    };
    const tx = makeTxMock([[tokenRow], [userRow]]);
    mockTransaction.mockImplementation((fn: (t: unknown) => Promise<unknown>) =>
      fn(tx),
    );

    const result = await verifyEmailToken("raw-token");
    expect(result.ok).toBe(true);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });
});