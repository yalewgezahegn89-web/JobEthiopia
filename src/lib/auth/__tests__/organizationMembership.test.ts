import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockSelectRows: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      organizationMembers: {
        findFirst: (...args: unknown[]) => mocks.mockFindFirst(...args),
      },
    },
    select: (fields: Record<string, unknown>) => ({
      from: () => ({
        where: () => mocks.mockSelectRows(),
      }),
    }),
  },
}));

import {
  getUserOrganizationIds,
  isOrganizationMember,
  requireOrganizationMembership,
} from "@/lib/auth/organizationMembership";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ORG_ID = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getUserOrganizationIds", () => {
  it("returns organization IDs for a user", async () => {
    mocks.mockSelectRows.mockResolvedValue([
      { organizationId: ORG_ID },
      { organizationId: "33333333-3333-4333-8333-333333333333" },
    ]);

    const result = await getUserOrganizationIds(USER_ID);
    expect(result).toHaveLength(2);
    expect(result).toContain(ORG_ID);
  });

  it("returns empty array when no memberships exist", async () => {
    mocks.mockSelectRows.mockResolvedValue([]);

    const result = await getUserOrganizationIds(USER_ID);
    expect(result).toEqual([]);
  });
});

describe("isOrganizationMember", () => {
  it("returns true when membership exists", async () => {
    mocks.mockFindFirst.mockResolvedValue({ id: "some-id" });

    const result = await isOrganizationMember(USER_ID, ORG_ID);
    expect(result).toBe(true);
  });

  it("returns false when membership does not exist", async () => {
    mocks.mockFindFirst.mockResolvedValue(null);

    const result = await isOrganizationMember(USER_ID, ORG_ID);
    expect(result).toBe(false);
  });
});

describe("requireOrganizationMembership", () => {
  it("returns void when member", async () => {
    mocks.mockFindFirst.mockResolvedValue({ id: "some-id" });

    await expect(
      requireOrganizationMembership(USER_ID, ORG_ID),
    ).resolves.toBeUndefined();
  });

  it("throws when not a member", async () => {
    mocks.mockFindFirst.mockResolvedValue(null);

    await expect(
      requireOrganizationMembership(USER_ID, ORG_ID),
    ).rejects.toThrow("Not a member of this organization");
  });
});
