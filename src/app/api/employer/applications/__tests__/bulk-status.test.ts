import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockCookieGet: vi.fn(),
  mockVerifySession: vi.fn(),
  mockCsrf: vi.fn(),
  mockCheckBodySize: vi.fn(),
  mockChangeStatuses: vi.fn(),
  mockGetRequestId: vi.fn(),
  mockDispatch: vi.fn(),
  mockDbSelect: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (...a: unknown[]) => mocks.mockCookieGet(...a) }),
}));

vi.mock("@/lib/auth/session", () => ({
  verifySession: (...a: unknown[]) => mocks.mockVerifySession(...a),
}));

vi.mock("@/lib/auth/csrf", () => ({
  assertTrustedCsrfFromRequest: (...a: unknown[]) => mocks.mockCsrf(...a),
}));

vi.mock("@/lib/apiUtils", () => ({
  checkBodySize: (...a: unknown[]) => mocks.mockCheckBodySize(...a),
}));

vi.mock("@/lib/employer/applications", () => ({
  changeEmployerApplicationStatuses: (...a: unknown[]) =>
    mocks.mockChangeStatuses(...a),
}));

vi.mock("@/lib/observability/requestId", () => ({
  getRequestId: (...a: unknown[]) => mocks.mockGetRequestId(...a),
}));

vi.mock("@/lib/email", () => ({
  dispatchApplicationStatusNotification: (...a: unknown[]) =>
    mocks.mockDispatch(...a),
}));

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mocks.mockDbSelect(...args),
  },
}));

import { PATCH } from "../status/route";

const ORG_ADMIN = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "admin@example.com",
  name: "Admin",
  role: "ORGANIZATION_ADMIN",
};
const CANDIDATE = { ...ORG_ADMIN, id: "u2", role: "CANDIDATE" };
const STAFF = { ...ORG_ADMIN, id: "u3", role: "ADMIN" };
const APP_A = "aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const APP_B = "bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/employer/applications/status", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function recipientChain(rows: unknown[]) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue(rows);
  return chain;
}

function stubAuthed() {
  mocks.mockCookieGet.mockReturnValue({ value: "valid-token" });
  mocks.mockVerifySession.mockResolvedValue(ORG_ADMIN);
  mocks.mockCsrf.mockResolvedValue(true);
  mocks.mockCheckBodySize.mockReturnValue(null);
  mocks.mockGetRequestId.mockResolvedValue("req-1");
  mocks.mockDispatch.mockResolvedValue(undefined);
}

beforeEach(() => {
  vi.clearAllMocks();
  stubAuthed();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PATCH /api/employer/applications/status", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.mockCookieGet.mockReturnValue(undefined);
    const response = await PATCH(
      makeRequest({ applicationIds: [APP_A], status: "REVIEWING" }),
    );
    expect(response.status).toBe(401);
  });

  it("returns 403 for a candidate", async () => {
    mocks.mockVerifySession.mockResolvedValue(CANDIDATE);
    const response = await PATCH(
      makeRequest({ applicationIds: [APP_A], status: "REVIEWING" }),
    );
    expect(response.status).toBe(403);
  });

  it("returns 403 for staff", async () => {
    mocks.mockVerifySession.mockResolvedValue(STAFF);
    const response = await PATCH(
      makeRequest({ applicationIds: [APP_A], status: "REVIEWING" }),
    );
    expect(response.status).toBe(403);
  });

  it("returns 403 when CSRF fails", async () => {
    mocks.mockCsrf.mockRejectedValue(new Error("csrf"));
    const response = await PATCH(
      makeRequest({ applicationIds: [APP_A], status: "REVIEWING" }),
    );
    expect(response.status).toBe(403);
  });

  it("returns 422 for an empty ID list", async () => {
    const response = await PATCH(
      makeRequest({ applicationIds: [], status: "REVIEWING" }),
    );
    expect(response.status).toBe(422);
  });

  it("returns 422 for a malformed UUID", async () => {
    const response = await PATCH(
      makeRequest({ applicationIds: ["not-a-uuid"], status: "REVIEWING" }),
    );
    expect(response.status).toBe(422);
  });

  it("returns 422 for duplicate IDs", async () => {
    const response = await PATCH(
      makeRequest({ applicationIds: [APP_A, APP_A], status: "REVIEWING" }),
    );
    expect(response.status).toBe(422);
  });

  it("returns 422 for more than 50 IDs", async () => {
    const ids = Array.from({ length: 51 }, (_, i) =>
      `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    );
    const response = await PATCH(makeRequest({ applicationIds: ids, status: "REVIEWING" }));
    expect(response.status).toBe(422);
  });

  it("returns 422 for an invalid status", async () => {
    const response = await PATCH(
      makeRequest({ applicationIds: [APP_A], status: "WITHDRAWN" }),
    );
    expect(response.status).toBe(422);
  });

  it("returns 422 for an unknown field", async () => {
    const response = await PATCH(
      makeRequest({
        applicationIds: [APP_A],
        status: "REVIEWING",
        unexpected: "x",
      }),
    );
    expect(response.status).toBe(422);
  });

  it("returns 422 for a forged organizationId", async () => {
    const response = await PATCH(
      makeRequest({
        applicationIds: [APP_A],
        status: "REVIEWING",
        organizationId: "22222222-2222-4222-8222-222222222222",
      }),
    );
    expect(response.status).toBe(422);
  });

  it("returns 422 for a forged candidateUserId", async () => {
    const response = await PATCH(
      makeRequest({
        applicationIds: [APP_A],
        status: "REVIEWING",
        candidateUserId: "u-cand",
      }),
    );
    expect(response.status).toBe(422);
  });

  it("returns 422 for a forged actorUserId", async () => {
    const response = await PATCH(
      makeRequest({ applicationIds: [APP_A], status: "REVIEWING", actorUserId: "u-actor" }),
    );
    expect(response.status).toBe(422);
  });

  it("returns 422 for a forged currentStatus", async () => {
    const response = await PATCH(
      makeRequest({ applicationIds: [APP_A], status: "REVIEWING", currentStatus: "SUBMITTED" }),
    );
    expect(response.status).toBe(422);
  });

  it("returns 404 when the DAL reports NOT_FOUND", async () => {
    mocks.mockChangeStatuses.mockResolvedValue({ ok: false, code: "NOT_FOUND" });
    const response = await PATCH(
      makeRequest({ applicationIds: [APP_A], status: "REVIEWING" }),
    );
    expect(response.status).toBe(404);
  });

  it("returns 409 for an invalid transition", async () => {
    mocks.mockChangeStatuses.mockResolvedValue({
      ok: false,
      code: "INVALID_TRANSITION",
    });
    const response = await PATCH(
      makeRequest({ applicationIds: [APP_A], status: "REVIEWING" }),
    );
    expect(response.status).toBe(409);
  });

  it("returns 403 for a mixed-org batch", async () => {
    mocks.mockChangeStatuses.mockResolvedValue({ ok: false, code: "MIXED_ORG" });
    const response = await PATCH(
      makeRequest({ applicationIds: [APP_A, APP_B], status: "REVIEWING" }),
    );
    expect(response.status).toBe(403);
  });

  it("returns 403 for an inactive organization", async () => {
    mocks.mockChangeStatuses.mockResolvedValue({ ok: false, code: "ORG_INACTIVE" });
    const response = await PATCH(
      makeRequest({ applicationIds: [APP_A], status: "REVIEWING" }),
    );
    expect(response.status).toBe(403);
  });

  it("returns 200 and dispatches notifications on success", async () => {
    mocks.mockChangeStatuses.mockResolvedValue({
      ok: true,
      items: [
        { id: APP_A, status: "REVIEWING" },
        { id: APP_B, status: "REVIEWING" },
      ],
      count: 2,
    });
    mocks.mockDbSelect.mockReturnValueOnce(
      recipientChain([
        {
          applicationId: APP_A,
          candidateEmail: "a@example.com",
          candidateName: "Abebe",
          jobTitle: "Engineer",
          organizationName: "Acme",
        },
        {
          applicationId: APP_B,
          candidateEmail: "b@example.com",
          candidateName: "Bekele",
          jobTitle: "Engineer",
          organizationName: "Acme",
        },
      ]),
    );

    const response = await PATCH(
      makeRequest({ applicationIds: [APP_A, APP_B], status: "REVIEWING" }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.count).toBe(2);
    expect(body.status).toBe("REVIEWING");
    expect(body.updated).toHaveLength(2);
    expect(body.updated[0]).toEqual({ id: APP_A, status: "REVIEWING" });

    // Notifications dispatched AFTER commit.
    expect(mocks.mockDispatch).toHaveBeenCalledTimes(2);
    expect(mocks.mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: APP_A,
        candidateEmail: "a@example.com",
        newStatus: "REVIEWING",
      }),
    );
  });

  it("dispatches notifications only after commit (no dispatch on failure)", async () => {
    mocks.mockChangeStatuses.mockResolvedValue({
      ok: false,
      code: "INVALID_TRANSITION",
    });
    const response = await PATCH(
      makeRequest({ applicationIds: [APP_A], status: "REVIEWING" }),
    );
    expect(response.status).toBe(409);
    expect(mocks.mockDispatch).not.toHaveBeenCalled();
  });

  it("does not call the DAL for validation failures", async () => {
    const response = await PATCH(
      makeRequest({ applicationIds: [APP_A], status: "WITHDRAWN" }),
    );
    expect(response.status).toBe(422);
    expect(mocks.mockChangeStatuses).not.toHaveBeenCalled();
  });

  it("exposes no candidate PII in the success response", async () => {
    mocks.mockChangeStatuses.mockResolvedValue({
      ok: true,
      items: [{ id: APP_A, status: "SHORTLISTED" }],
      count: 1,
    });
    mocks.mockDbSelect.mockReturnValueOnce(
      recipientChain([
        {
          applicationId: APP_A,
          candidateEmail: "secret@example.com",
          candidateName: "Secret",
          jobTitle: "Engineer",
          organizationName: "Acme",
        },
      ]),
    );
    const response = await PATCH(
      makeRequest({ applicationIds: [APP_A], status: "SHORTLISTED" }),
    );
    const body = await response.json();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("secret@example.com");
    expect(serialized).not.toContain("Secret");
    expect(serialized).not.toContain("coverLetter");
  });

  it("does not expose raw database/provider errors", async () => {
    mocks.mockChangeStatuses.mockRejectedValue(new Error("connection reset by peer"));
    const response = await PATCH(
      makeRequest({ applicationIds: [APP_A], status: "REVIEWING" }),
    );
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain("connection reset");
  });

  it("swallows notification failures without affecting the response", async () => {
    mocks.mockChangeStatuses.mockResolvedValue({
      ok: true,
      items: [{ id: APP_A, status: "REJECTED" }],
      count: 1,
    });
    mocks.mockDbSelect.mockReturnValueOnce(
      recipientChain([
        {
          applicationId: APP_A,
          candidateEmail: "a@example.com",
          candidateName: "A",
          jobTitle: "Engineer",
          organizationName: "Acme",
        },
      ]),
    );
    mocks.mockDispatch.mockRejectedValue(new Error("smtp down"));
    const response = await PATCH(
      makeRequest({ applicationIds: [APP_A], status: "REJECTED" }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.count).toBe(1);
  });
});
