import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockDbInsert: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mocks.mockDbSelect(...args),
    update: (...args: unknown[]) => mocks.mockDbUpdate(...args),
    insert: (...args: unknown[]) => mocks.mockDbInsert(...args),
  },
}));

vi.mock("@/db/schema/organizations", () => ({
  organizations: {
    id: "orgs_id",
    name: "orgs_name",
    description: "orgs_description",
    industry: "orgs_industry",
    websiteUrl: "orgs_website_url",
    status: "orgs_status",
    updatedAt: "orgs_updated_at",
  },
}));

vi.mock("@/db/schema/auditLog", () => ({ auditLog: {} }));

import {
  updateOrganizationSettings,
  getOrganizationForSettings,
} from "../organization";

const ORG_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "11111111-1111-4111-8111-111111111111";

const UPDATED_ORG = {
  id: ORG_ID,
  name: "Almaz Coffee PLC",
  description: null,
  industry: "Coffee",
  websiteUrl: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

function buildActiveCheck(status: string) {
  mocks.mockDbSelect.mockImplementation(() => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.from = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockResolvedValue(
      status === "MISSING"
        ? []
        : [{ id: ORG_ID, status }],
    );
    return chain;
  });
}

function mockSuccessPath() {
  mocks.mockDbUpdate.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([UPDATED_ORG]),
      }),
    }),
  });
  mocks.mockDbInsert.mockReturnValue({
    values: vi.fn().mockResolvedValue({}),
  });
}

describe("updateOrganizationSettings", () => {
  it("updates an active organization and writes an audit row", async () => {
    buildActiveCheck("ACTIVE");
    mockSuccessPath();

    const result = await updateOrganizationSettings(USER_ID, ORG_ID, {
      name: "Almaz Coffee PLC",
      industry: "Coffee",
    });

    expect(result).toEqual({ ok: true, item: UPDATED_ORG });
    expect(mocks.mockDbInsert).toHaveBeenCalledTimes(1);
    expect(mocks.mockDbInsert).toHaveBeenCalledWith({});
    const values = mocks.mockDbInsert.mock.results[0].value.values.mock.calls[0][0];
    expect(values.action).toBe("ORGANIZATION_SETTINGS_UPDATED");
    expect(values.actorUserId).toBe(USER_ID);
    expect(values.targetType).toBe("organization");
    expect(values.targetId).toBe(ORG_ID);
    expect(values.metadata.fields.sort()).toEqual(["industry", "name"]);
  });

  it("returns NOT_FOUND when the organization does not exist", async () => {
    buildActiveCheck("MISSING");

    const result = await updateOrganizationSettings(USER_ID, ORG_ID, {
      name: "New Name",
    });

    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(mocks.mockDbUpdate).not.toHaveBeenCalled();
    expect(mocks.mockDbInsert).not.toHaveBeenCalled();
  });

  it("returns FORBIDDEN when the organization is not active", async () => {
    buildActiveCheck("SUSPENDED");

    const result = await updateOrganizationSettings(USER_ID, ORG_ID, {
      name: "New Name",
    });

    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(mocks.mockDbUpdate).not.toHaveBeenCalled();
    expect(mocks.mockDbInsert).not.toHaveBeenCalled();
  });

  it("returns VALIDATION when the name is empty", async () => {
    buildActiveCheck("ACTIVE");

    const result = await updateOrganizationSettings(USER_ID, ORG_ID, {
      name: "   ",
    });

    expect(result).toEqual({ ok: false, code: "VALIDATION" });
    expect(mocks.mockDbUpdate).not.toHaveBeenCalled();
  });

  it("does not write an audit row when no fields were changed", async () => {
    buildActiveCheck("ACTIVE");
    mocks.mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([UPDATED_ORG]),
        }),
      }),
    });
    mocks.mockDbInsert.mockReturnValue({
      values: vi.fn().mockResolvedValue({}),
    });

    const result = await updateOrganizationSettings(USER_ID, ORG_ID, {});

    expect(result).toEqual({ ok: true, item: UPDATED_ORG });
    const values = mocks.mockDbInsert.mock.results[0].value.values.mock.calls[0][0];
    expect(values.metadata.fields).toEqual([]);
  });

  it("returns NOT_FOUND when the updated row cannot be read back", async () => {
    buildActiveCheck("ACTIVE");
    mocks.mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const result = await updateOrganizationSettings(USER_ID, ORG_ID, {
      name: "New Name",
    });

    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(mocks.mockDbInsert).not.toHaveBeenCalled();
  });
});

describe("getOrganizationForSettings", () => {
  it("returns null when no organization matches", async () => {
    mocks.mockDbSelect.mockImplementation(() => {
      const chain: Record<string, ReturnType<typeof vi.fn>> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue([]);
      return chain;
    });

    await expect(getOrganizationForSettings(ORG_ID)).resolves.toBeNull();
  });

  it("returns null when the id is empty", async () => {
    await expect(getOrganizationForSettings("")).resolves.toBeNull();
    expect(mocks.mockDbSelect).not.toHaveBeenCalled();
  });
});