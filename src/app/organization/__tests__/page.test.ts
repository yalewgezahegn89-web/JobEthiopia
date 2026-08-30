import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockGetUserOrgIds: vi.fn(),
  mockDbSelect: vi.fn(),
}));

vi.mock("@/lib/auth/context", () => ({
  getCurrentUser: (...args: unknown[]) => mocks.mockGetCurrentUser(...args),
}));

vi.mock("@/lib/auth/organizationMembership", () => ({
  getUserOrganizationIds: (...args: unknown[]) =>
    mocks.mockGetUserOrgIds(...args),
}));

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mocks.mockDbSelect(...args),
  },
}));

vi.mock("@/app/organization/nav", () => ({
  OrganizationNav: () => null,
}));

import OrganizationDashboardPage from "../page";

function buildChain(result: unknown) {
  const resolved = Array.isArray(result) ? result : [result];
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.groupBy = vi.fn().mockImplementation((_cb?: unknown) =>
    Promise.resolve(resolved),
  );
  chain.then = vi.fn().mockImplementation(function (
    this: unknown,
    onFulfilled?: (value: unknown) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) {
    return Promise.resolve(resolved).then(onFulfilled, onRejected);
  });
  return chain;
}

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ORG_ID = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("OrganizationDashboardPage", () => {
  it("redirects when unauthenticated", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue(null);
    await expect(OrganizationDashboardPage()).rejects.toThrow("NEXT_REDIRECT");
  });

  it("redirects when role is CANDIDATE", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue({
      id: USER_ID,
      role: "CANDIDATE",
    });
    await expect(OrganizationDashboardPage()).rejects.toThrow("NEXT_REDIRECT");
  });

  it("redirects when role is STAFF", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue({
      id: USER_ID,
      role: "STAFF",
    });
    await expect(OrganizationDashboardPage()).rejects.toThrow("NEXT_REDIRECT");
  });

  it("renders no organizations state when user has no memberships", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue({
      id: USER_ID,
      role: "ORGANIZATION_ADMIN",
    });
    mocks.mockGetUserOrgIds.mockResolvedValue([]);

    const element = await OrganizationDashboardPage();
    const html = renderToString(element);
    expect(html).toContain("No organizations");
  });

  it("renders no active organizations state", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue({
      id: USER_ID,
      role: "ORGANIZATION_ADMIN",
    });
    mocks.mockGetUserOrgIds.mockResolvedValue([ORG_ID]);
    mocks.mockDbSelect.mockReturnValueOnce(buildChain([]));

    const element = await OrganizationDashboardPage();
    const html = renderToString(element);
    expect(html).toContain("No active organizations");
  });

  it("renders dashboard with KPI cards", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue({
      id: USER_ID,
      role: "ORGANIZATION_ADMIN",
    });
    mocks.mockGetUserOrgIds.mockResolvedValue([ORG_ID]);

    mocks.mockDbSelect.mockReturnValueOnce(buildChain([{ id: ORG_ID }]));
    mocks.mockDbSelect.mockReturnValueOnce(
      buildChain([
        { status: "PUBLISHED", count: 3 },
        { status: "DRAFT", count: 2 },
      ]),
    );
    mocks.mockDbSelect.mockReturnValueOnce(
      buildChain([
        { status: "SUBMITTED", count: 5 },
        { status: "SHORTLISTED", count: 1 },
      ]),
    );
    mocks.mockDbSelect.mockReturnValueOnce(buildChain([]));
    mocks.mockDbSelect.mockReturnValueOnce(buildChain([]));

    const element = await OrganizationDashboardPage();
    const html = renderToString(element);
    expect(html).toContain("Dashboard");
    expect(html).toContain("Published Jobs");
    expect(html).toContain("Drafts");
    expect(html).toContain("Pending Review");
    expect(html).toContain("Applications to Review");
    expect(html).toContain("Shortlisted");
    expect(html).toContain("Total Applications");
  });

  it("renders quick action links", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue({
      id: USER_ID,
      role: "ORGANIZATION_ADMIN",
    });
    mocks.mockGetUserOrgIds.mockResolvedValue([ORG_ID]);

    mocks.mockDbSelect.mockReturnValueOnce(buildChain([{ id: ORG_ID }]));
    mocks.mockDbSelect.mockReturnValueOnce(buildChain([]));
    mocks.mockDbSelect.mockReturnValueOnce(buildChain([]));
    mocks.mockDbSelect.mockReturnValueOnce(buildChain([]));
    mocks.mockDbSelect.mockReturnValueOnce(buildChain([]));

    const element = await OrganizationDashboardPage();
    const html = renderToString(element);
    expect(html).toContain("/organization/jobs/create");
    expect(html).toContain("/organization/jobs");
    expect(html).toContain("/organization/applications?status=SUBMITTED");
  });

  it("renders upcoming deadlines", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue({
      id: USER_ID,
      role: "ORGANIZATION_ADMIN",
    });
    mocks.mockGetUserOrgIds.mockResolvedValue([ORG_ID]);

    mocks.mockDbSelect.mockReturnValueOnce(buildChain([{ id: ORG_ID }]));
    mocks.mockDbSelect.mockReturnValueOnce(buildChain([]));
    mocks.mockDbSelect.mockReturnValueOnce(buildChain([]));

    const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    mocks.mockDbSelect.mockReturnValueOnce(
      buildChain([
        {
          id: "job-1",
          title: "Senior Developer",
          organizationName: "Acme Corp",
          deadline: futureDate,
        },
      ]),
    );
    mocks.mockDbSelect.mockReturnValueOnce(buildChain([]));

    const element = await OrganizationDashboardPage();
    const html = renderToString(element);
    expect(html).toContain("Senior Developer");
    expect(html).toContain("Due in 3 days");
  });

  it("renders no upcoming deadlines state", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue({
      id: USER_ID,
      role: "ORGANIZATION_ADMIN",
    });
    mocks.mockGetUserOrgIds.mockResolvedValue([ORG_ID]);

    mocks.mockDbSelect.mockReturnValueOnce(buildChain([{ id: ORG_ID }]));
    mocks.mockDbSelect.mockReturnValueOnce(buildChain([]));
    mocks.mockDbSelect.mockReturnValueOnce(buildChain([]));
    mocks.mockDbSelect.mockReturnValueOnce(buildChain([]));
    mocks.mockDbSelect.mockReturnValueOnce(buildChain([]));

    const element = await OrganizationDashboardPage();
    const html = renderToString(element);
    expect(html).toContain("No upcoming deadlines");
  });

  it("renders error state on DB failure", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue({
      id: USER_ID,
      role: "ORGANIZATION_ADMIN",
    });
    mocks.mockGetUserOrgIds.mockResolvedValue([ORG_ID]);

    const errorChain = buildChain([]);
    errorChain.then = vi.fn().mockImplementation(function (
      this: unknown,
      _onFulfilled?: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) {
      return Promise.reject(new Error("DB connection")).catch((e) => {
        if (onRejected) return onRejected(e);
        throw e;
      });
    });
    mocks.mockDbSelect.mockReturnValueOnce(errorChain);

    const element = await OrganizationDashboardPage();
    const html = renderToString(element);
    expect(html).toContain("We could not load the dashboard right now");
  });

  it("excludes inactive organizations from counts", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue({
      id: USER_ID,
      role: "ORGANIZATION_ADMIN",
    });
    mocks.mockGetUserOrgIds.mockResolvedValue([ORG_ID]);
    mocks.mockDbSelect.mockReturnValueOnce(buildChain([]));

    const element = await OrganizationDashboardPage();
    const html = renderToString(element);
    expect(html).toContain("No active organizations");
  });
});
