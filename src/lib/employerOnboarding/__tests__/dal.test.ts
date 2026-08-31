import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    transaction: (...args: unknown[]) => mocks.mockTransaction(...args),
  },
}));

vi.mock("@/db/schema/users", () => ({
  users: {
    id: "users_id",
    email: "users_email",
    name: "users_name",
    passwordHash: "users_password_hash",
    role: "users_role",
    isActive: "users_is_active",
  },
}));

vi.mock("@/db/schema/auditLog", () => ({ auditLog: {} }));

vi.mock("@/db/schema/employerOnboardingRequests", () => ({
  employerOnboardingRequests: {
    id: "eor_id",
    userId: "eor_user_id",
    organizationName: "eor_organization_name",
    organizationSlug: "eor_organization_slug",
    industry: "eor_industry",
    description: "eor_description",
    websiteUrl: "eor_website_url",
    contactPhone: "eor_contact_phone",
    locationId: "eor_location_id",
  },
}));

import { submitEmployerOnboarding, isDuplicateError } from "../dal";

interface TxCapture {
  userWrite?: Record<string, unknown>;
  requestWrite?: Record<string, unknown>;
  auditWrites?: Record<string, unknown>[];
  userInsertError?: unknown;
}

function buildTx(capture: TxCapture) {
  const tx = {
    insert: vi.fn().mockImplementation((table: Record<string, unknown>) => {
      const isUser = table.role === "users_role";
      const isRequest = table.organizationSlug === "eor_organization_slug";
      return {
        values: vi.fn().mockImplementation((values: Record<string, unknown>) => {
          if (isUser) {
            const rejectUser = capture.userInsertError !== undefined;
            capture.userWrite = values;
            if (rejectUser) {
              return {
                returning: () =>
                  Promise.reject(capture.userInsertError),
              };
            }
            return {
              returning: () => Promise.resolve([{ id: "new-user-id" }]),
            };
          }
          if (isRequest) {
            capture.requestWrite = values;
            return {
              returning: () => Promise.resolve([{ id: "new-request-id" }]),
            };
          }
          capture.auditWrites ??= [];
          capture.auditWrites.push(values);
          return Promise.resolve({});
        }),
      };
    }),
  };
  return tx;
}

function validInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "Almaz Tesfaye",
    email: "almaz@example.com",
    password: "correct-password-123",
    confirmPassword: "correct-password-123",
    organizationName: "Almaz Coffee PLC",
    organizationSlug: "almaz-coffee",
    industry: "Coffee",
    description: "A roastery",
    websiteUrl: "https://almaz.example.com",
    contactPhone: "+251911000000",
    locationId: "00000000-0000-4000-8000-000000000001",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("employer onboarding schema", () => {
  it("accepts valid input", async () => {
    const capture: TxCapture = {};
    mocks.mockTransaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) =>
      fn(buildTx(capture)),
    );
    const r = await submitEmployerOnboarding(validInput());
    expect(r).toEqual({ ok: true, userId: "new-user-id", requestId: "new-request-id" });
  });

  it("accepts missing optional organization fields", async () => {
    const capture: TxCapture = {};
    mocks.mockTransaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) =>
      fn(buildTx(capture)),
    );
    const r = await submitEmployerOnboarding(
      validInput({ industry: "", description: "", websiteUrl: "", contactPhone: "", locationId: "" }),
    );
    expect(r.ok).toBe(true);
  });

  it("rejects an invalid email", async () => {
    const r = await submitEmployerOnboarding(validInput({ email: "not-an-email" }));
    expect(r).toEqual({ ok: false, code: "invalid_input" });
  });

  it("rejects a short password", async () => {
    const r = await submitEmployerOnboarding(validInput({ password: "short", confirmPassword: "short" }));
    expect(r).toEqual({ ok: false, code: "invalid_input" });
  });

  it("rejects a password mismatch", async () => {
    const r = await submitEmployerOnboarding(validInput({ confirmPassword: "different" }));
    expect(r).toEqual({ ok: false, code: "invalid_input" });
  });

  it("rejects a missing organization name", async () => {
    const r = await submitEmployerOnboarding(validInput({ organizationName: "   " }));
    expect(r).toEqual({ ok: false, code: "invalid_input" });
  });

  it("rejects an invalid organization slug", async () => {
    const r = await submitEmployerOnboarding(validInput({ organizationSlug: "Bad Slug!" }));
    expect(r).toEqual({ ok: false, code: "invalid_input" });
  });

  it("rejects a bad website url", async () => {
    const r = await submitEmployerOnboarding(validInput({ websiteUrl: "not-a-url" }));
    expect(r).toEqual({ ok: false, code: "invalid_input" });
  });

  it("rejects an invalid location id", async () => {
    const r = await submitEmployerOnboarding(validInput({ locationId: "nope" }));
    expect(r).toEqual({ ok: false, code: "invalid_input" });
  });

  it("rejects unknown properties", async () => {
    const r = await submitEmployerOnboarding(validInput({ extraField: "x" }));
    expect(r).toEqual({ ok: false, code: "invalid_input" });
  });

  it("rejects role injection", async () => {
    const r = await submitEmployerOnboarding(validInput({ role: "SUPER_ADMIN" }));
    expect(r).toEqual({ ok: false, code: "invalid_input" });
  });

  it("rejects userId injection", async () => {
    const r = await submitEmployerOnboarding(validInput({ userId: "controlled-id" }));
    expect(r).toEqual({ ok: false, code: "invalid_input" });
  });

  it("rejects isVerified injection", async () => {
    const r = await submitEmployerOnboarding(validInput({ isVerified: true }));
    expect(r).toEqual({ ok: false, code: "invalid_input" });
  });

  it("rejects status injection", async () => {
    const r = await submitEmployerOnboarding(validInput({ status: "APPROVED" }));
    expect(r).toEqual({ ok: false, code: "invalid_input" });
  });

  it("rejects reviewedBy injection", async () => {
    const r = await submitEmployerOnboarding(validInput({ reviewedBy: "controlled-id" }));
    expect(r).toEqual({ ok: false, code: "invalid_input" });
  });
});

describe("employer onboarding DAL", () => {
  it("creates an active CANDIDATE with a hashed password and a request row", async () => {
    const capture: TxCapture = {};
    mocks.mockTransaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) =>
      fn(buildTx(capture)),
    );
    await submitEmployerOnboarding(validInput({ email: "  ALMAZ@Example.com " }));

    const stored = capture.userWrite!;
    expect(stored.role).toBe("CANDIDATE");
    expect(stored.isActive).toBeUndefined();
    expect(stored.passwordHash).not.toBe("correct-password-123");
    expect(String(stored.passwordHash)).toMatch(/^scrypt\$/);
    expect(stored.confirmPassword).toBeUndefined();
    expect(JSON.stringify(capture.userWrite)).not.toContain("correct-password-123");
    expect(stored.email).toBe("almaz@example.com");

    const request = capture.requestWrite!;
    expect(request.userId).toBe("new-user-id");
    expect(request.organizationName).toBe("Almaz Coffee PLC");
    expect(request.organizationSlug).toBe("almaz-coffee");
    expect(request.status).toBeUndefined();
  });

  it("writes an EMPLOYER_ONBOARDING_REQUESTED audit entry with no PII", async () => {
    const capture: TxCapture = {};
    mocks.mockTransaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) =>
      fn(buildTx(capture)),
    );
    await submitEmployerOnboarding(validInput({ email: "almaz@example.com", password: "correct-password-123" }));

    const auditWrites = capture.auditWrites ?? [];
    const audit = auditWrites[0];
    expect(audit).toBeTruthy();
    expect(audit!.action).toBe("EMPLOYER_ONBOARDING_REQUESTED");
    expect(audit!.targetType).toBe("employer_onboarding_request");
    expect(audit!.targetId).toBe("new-request-id");
    const serialized = JSON.stringify(capture.auditWrites);
    expect(serialized).not.toContain("almaz@example.com");
    expect(serialized).not.toContain("correct-password-123");
    expect(serialized).not.toContain("+251911000000");
  });

  it("maps a unique-violation error to a neutral duplicate result", async () => {
    const capture: TxCapture = {
      userInsertError: Object.assign(new Error('duplicate key value violates unique constraint "users_email_unique"'), {
        code: "23505",
      }),
    };
    mocks.mockTransaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) =>
      fn(buildTx(capture)),
    );
    const r = await submitEmployerOnboarding(validInput({ email: "dup@example.com" }));
    expect(r).toEqual({ ok: false, code: "duplicate" });
  });

  it("does not leak raw database errors for other failures", async () => {
    const capture: TxCapture = { userInsertError: new Error("connection refused") };
    mocks.mockTransaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) =>
      fn(buildTx(capture)),
    );
    const r = await submitEmployerOnboarding(validInput());
    expect(r).toEqual({ ok: false, code: "error" });
    const serialized = JSON.stringify(r);
    expect(serialized).not.toContain("connection refused");
  });
});

describe("isDuplicateError", () => {
  it("recognizes the users_email_unique constraint name", () => {
    expect(isDuplicateError(new Error('duplicate key value violates unique constraint "users_email_unique"'))).toBe(true);
  });
  it("recognizes the sqlstate 23505", () => {
    const err = new Error("duplicate");
    (err as { code?: string }).code = "23505";
    expect(isDuplicateError(err)).toBe(true);
  });
  it("returns false for unrelated errors", () => {
    expect(isDuplicateError(new Error("boom"))).toBe(false);
    expect(isDuplicateError("not-an-error")).toBe(false);
  });
});
