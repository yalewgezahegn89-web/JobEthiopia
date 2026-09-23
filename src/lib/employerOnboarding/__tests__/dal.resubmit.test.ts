import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    transaction: (...args: unknown[]) => mocks.mockTransaction(...args),
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
    status: "eor_status",
  },
}));

import { resubmitEmployerOnboarding } from "../dal";

const USER_ID = "11111111-1111-4111-8111-111111111111";

interface TxCapture {
  requestWrite?: Record<string, unknown>;
  auditWrites?: Record<string, unknown>[];
  latestRequest?: { id: string; status: string } | null;
  requestInsertError?: unknown;
}

function buildTx(capture: TxCapture) {
  const tx = {
    query: {
      employerOnboardingRequests: {
        findFirst: vi.fn().mockImplementation(
          async (): Promise<{ id: string; status: string } | null> =>
            capture.latestRequest ?? null,
        ),
      },
    },
    insert: vi.fn().mockImplementation((table: Record<string, unknown>) => {
      const isRequest = table.organizationSlug === "eor_organization_slug";
      return {
        values: vi.fn().mockImplementation((values: Record<string, unknown>) => {
          if (isRequest) {
            capture.requestWrite = values;
            if (capture.requestInsertError !== undefined) {
              return {
                returning: () => Promise.reject(capture.requestInsertError),
              };
            }
            return {
              returning: () => Promise.resolve([{ id: "resubmitted-request-id" }]),
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
    organizationName: "Almaz Coffee PLC",
    organizationSlug: "almaz-coffee",
    industry: "Coffee",
    description: "A revised roastery profile",
    websiteUrl: "https://almaz.example.com",
    contactPhone: "+251911000000",
    locationId: "00000000-0000-4000-8000-000000000001",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("employer onboarding re-submission schema", () => {
  it("accepts valid organization fields", async () => {
    const capture: TxCapture = { latestRequest: { id: "r1", status: "REJECTED" } };
    mocks.mockTransaction.mockImplementation(
      async (fn: (t: unknown) => Promise<unknown>) => fn(buildTx(capture)),
    );
    const r = await resubmitEmployerOnboarding(USER_ID, validInput());
    expect(r).toEqual({ ok: true, requestId: "resubmitted-request-id" });
  });

  it("accepts empty optional organization fields", async () => {
    const capture: TxCapture = { latestRequest: { id: "r1", status: "REJECTED" } };
    mocks.mockTransaction.mockImplementation(
      async (fn: (t: unknown) => Promise<unknown>) => fn(buildTx(capture)),
    );
    const r = await resubmitEmployerOnboarding(
      USER_ID,
      validInput({ industry: "", description: "", websiteUrl: "", contactPhone: "", locationId: "" }),
    );
    expect(r.ok).toBe(true);
  });

  it("rejects missing organization name", async () => {
    const r = await resubmitEmployerOnboarding(USER_ID, validInput({ organizationName: "  " }));
    expect(r).toEqual({ ok: false, code: "invalid_input" });
  });

  it("rejects an invalid organization slug", async () => {
    const r = await resubmitEmployerOnboarding(USER_ID, validInput({ organizationSlug: "Bad Slug!" }));
    expect(r).toEqual({ ok: false, code: "invalid_input" });
  });

  it("rejects a bad website url", async () => {
    const r = await resubmitEmployerOnboarding(USER_ID, validInput({ websiteUrl: "not-a-url" }));
    expect(r).toEqual({ ok: false, code: "invalid_input" });
  });

  it("rejects an invalid location id", async () => {
    const r = await resubmitEmployerOnboarding(USER_ID, validInput({ locationId: "nope" }));
    expect(r).toEqual({ ok: false, code: "invalid_input" });
  });

  it("rejects credentials and other unknown properties", async () => {
    const r = await resubmitEmployerOnboarding(
      USER_ID,
      validInput({ name: "Hacker", email: "x@example.com", password: "guess", role: "SUPER_ADMIN" }),
    );
    expect(r).toEqual({ ok: false, code: "invalid_input" });
  });

  it("rejects privileged field injection (status, reviewedBy, userId)", async () => {
    const r = await resubmitEmployerOnboarding(
      USER_ID,
      validInput({ status: "APPROVED", reviewedBy: USER_ID, userId: "other-user" }),
    );
    expect(r).toEqual({ ok: false, code: "invalid_input" });
  });

  it("rejects a malformed user id", async () => {
    const r = await resubmitEmployerOnboarding("not-a-uuid", validInput());
    expect(r).toEqual({ ok: false, code: "invalid_input" });
  });
});

describe("employer onboarding re-submission DAL", () => {
  it("inserts a fresh PENDING request for the same user with no user insert", async () => {
    const capture: TxCapture = { latestRequest: { id: "rejected-1", status: "REJECTED" } };
    mocks.mockTransaction.mockImplementation(
      async (fn: (t: unknown) => Promise<unknown>) => fn(buildTx(capture)),
    );
    const r = await resubmitEmployerOnboarding(USER_ID, validInput());
    expect(r).toEqual({ ok: true, requestId: "resubmitted-request-id" });

    const request = capture.requestWrite!;
    expect(request.userId).toBe(USER_ID);
    expect(request.organizationName).toBe("Almaz Coffee PLC");
    expect(request.organizationSlug).toBe("almaz-coffee");
    expect(request.status).toBeUndefined();
    expect(request.reviewedBy).toBeUndefined();
    expect(request.reviewedAt).toBeUndefined();
    expect(request.role).toBeUndefined();
  });

  it("writes an EMPLOYER_ONBOARDING_REQUESTED audit entry with no PII", async () => {
    const capture: TxCapture = { latestRequest: { id: "rejected-1", status: "REJECTED" } };
    mocks.mockTransaction.mockImplementation(
      async (fn: (t: unknown) => Promise<unknown>) => fn(buildTx(capture)),
    );
    await resubmitEmployerOnboarding(USER_ID, validInput());

    const auditWrites = capture.auditWrites ?? [];
    const audit = auditWrites[0];
    expect(audit).toBeTruthy();
    expect(audit!.action).toBe("EMPLOYER_ONBOARDING_REQUESTED");
    expect(audit!.actorUserId).toBe(USER_ID);
    expect(audit!.targetType).toBe("employer_onboarding_request");
    expect(audit!.targetId).toBe("resubmitted-request-id");
    const serialized = JSON.stringify(capture.auditWrites);
    expect(serialized).not.toContain("+251911000000");
  });

  it("refuses to resubmit when the latest request is still PENDING", async () => {
    const capture: TxCapture = { latestRequest: { id: "pending-1", status: "PENDING" } };
    mocks.mockTransaction.mockImplementation(
      async (fn: (t: unknown) => Promise<unknown>) => fn(buildTx(capture)),
    );
    const r = await resubmitEmployerOnboarding(USER_ID, validInput());
    expect(r).toEqual({ ok: false, code: "not_eligible" });
    expect(capture.requestWrite).toBeUndefined();
  });

  it("refuses to resubmit when the latest request is APPROVED", async () => {
    const capture: TxCapture = { latestRequest: { id: "approved-1", status: "APPROVED" } };
    mocks.mockTransaction.mockImplementation(
      async (fn: (t: unknown) => Promise<unknown>) => fn(buildTx(capture)),
    );
    const r = await resubmitEmployerOnboarding(USER_ID, validInput());
    expect(r).toEqual({ ok: false, code: "not_eligible" });
    expect(capture.requestWrite).toBeUndefined();
  });

  it("refuses to resubmit when the user has no request", async () => {
    const capture: TxCapture = { latestRequest: null };
    mocks.mockTransaction.mockImplementation(
      async (fn: (t: unknown) => Promise<unknown>) => fn(buildTx(capture)),
    );
    const r = await resubmitEmployerOnboarding(USER_ID, validInput());
    expect(r).toEqual({ ok: false, code: "not_eligible" });
  });

  it("maps an organization-slug unique violation to a duplicate result", async () => {
    const capture: TxCapture = {
      latestRequest: { id: "rejected-1", status: "REJECTED" },
      requestInsertError: Object.assign(
        new Error('duplicate key value violates unique constraint "employer_onboarding_requests_organization_slug_unique"'),
        { code: "23505" },
      ),
    };
    mocks.mockTransaction.mockImplementation(
      async (fn: (t: unknown) => Promise<unknown>) => fn(buildTx(capture)),
    );
    const r = await resubmitEmployerOnboarding(USER_ID, validInput({ organizationSlug: "taken-slug" }));
    expect(r).toEqual({ ok: false, code: "duplicate" });
    expect(capture.auditWrites).toBeUndefined();
  });

  it("does not leak raw database errors for other failures", async () => {
    const capture: TxCapture = {
      latestRequest: { id: "rejected-1", status: "REJECTED" },
      requestInsertError: new Error("connection refused"),
    };
    mocks.mockTransaction.mockImplementation(
      async (fn: (t: unknown) => Promise<unknown>) => fn(buildTx(capture)),
    );
    const r = await resubmitEmployerOnboarding(USER_ID, validInput());
    expect(r).toEqual({ ok: false, code: "error" });
    expect(JSON.stringify(r)).not.toContain("connection refused");
  });
});