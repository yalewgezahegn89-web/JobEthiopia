import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockCookieGet: vi.fn(),
  mockVerifySession: vi.fn(),
  mockGetRequestId: vi.fn(),
  mockAssertTrustedCsrfFromRequest: vi.fn(),
  mockCheckBodySize: vi.fn(),
  mockGetUserOrgIds: vi.fn(),
  mockUpdateOrganizationSettings: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (...a: unknown[]) => mocks.mockCookieGet(...a),
  }),
}));

vi.mock("@/lib/auth/session", () => ({
  verifySession: (...a: unknown[]) => mocks.mockVerifySession(...a),
}));

vi.mock("@/lib/observability/requestId", () => ({
  getRequestId: (...a: unknown[]) => mocks.mockGetRequestId(...a),
}));

vi.mock("@/lib/observability/logger", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/auth/csrf", () => ({
  assertTrustedCsrfFromRequest: (...a: unknown[]) =>
    mocks.mockAssertTrustedCsrfFromRequest(...a),
}));

vi.mock("@/lib/apiUtils", () => ({
  checkBodySize: (...a: unknown[]) => mocks.mockCheckBodySize(...a),
}));

vi.mock("@/lib/auth/organizationMembership", () => ({
  getUserOrganizationIds: (...a: unknown[]) => mocks.mockGetUserOrgIds(...a),
}));

vi.mock("@/lib/employer/organization", () => ({
  updateOrganizationSettings: (...a: unknown[]) =>
    mocks.mockUpdateOrganizationSettings(...a),
}));

import { PATCH } from "../route";

const ORG_ADMIN = {
  id: "11111111-1111-4111-8111-111111111111",
  role: "ORGANIZATION_ADMIN",
};
const ORG_ID = "22222222-2222-4222-8222-222222222222";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/employer/organization", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function stubAuthed() {
  mocks.mockCookieGet.mockReturnValue({ value: "valid-token" });
  mocks.mockVerifySession.mockResolvedValue(ORG_ADMIN);
  mocks.mockGetRequestId.mockResolvedValue("req-1");
  mocks.mockAssertTrustedCsrfFromRequest.mockResolvedValue(undefined);
  mocks.mockCheckBodySize.mockReturnValue(undefined);
  mocks.mockGetUserOrgIds.mockResolvedValue([ORG_ID]);
}

beforeEach(() => {
  vi.clearAllMocks();
  stubAuthed();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PATCH /api/employer/organization", () => {
  const body = { organizationId: ORG_ID, name: "Almaz Coffee PLC" };

  it("returns 200 and the updated item on success", async () => {
    mocks.mockUpdateOrganizationSettings.mockResolvedValue({
      ok: true,
      item: { id: ORG_ID, name: "Almaz Coffee PLC", description: null, industry: null, websiteUrl: null },
    });

    const res = await PATCH(makeRequest(body));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.item.name).toBe("Almaz Coffee PLC");
    expect(mocks.mockUpdateOrganizationSettings).toHaveBeenCalledWith(
      ORG_ADMIN.id,
      ORG_ID,
      expect.objectContaining({ name: "Almaz Coffee PLC" }),
    );
  });

  it("returns 403 when the organization is not active", async () => {
    mocks.mockUpdateOrganizationSettings.mockResolvedValue({
      ok: false,
      code: "FORBIDDEN",
    });

    const res = await PATCH(makeRequest(body));
    expect(res.status).toBe(403);
  });

  it("returns 404 when the organization does not exist", async () => {
    mocks.mockUpdateOrganizationSettings.mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
    });

    const res = await PATCH(makeRequest(body));
    expect(res.status).toBe(404);
  });

  it("returns 422 on validation failure", async () => {
    mocks.mockUpdateOrganizationSettings.mockResolvedValue({
      ok: false,
      code: "VALIDATION",
    });

    const res = await PATCH(makeRequest(body));
    expect(res.status).toBe(422);
  });

  it("returns 403 when the user is not a member of the organization", async () => {
    mocks.mockGetUserOrgIds.mockResolvedValue(["other-org"]);

    const res = await PATCH(makeRequest(body));
    expect(res.status).toBe(403);
    expect(mocks.mockUpdateOrganizationSettings).not.toHaveBeenCalled();
  });
});