import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockGuard: vi.fn(),
  mockCsrf: vi.fn(),
  mockCreateCategory: vi.fn(),
  mockUpdateCategory: vi.fn(),
  mockDeleteCategory: vi.fn(),
  mockToggleCategory: vi.fn(),
  mockCreateProfession: vi.fn(),
  mockUpdateProfession: vi.fn(),
  mockDeleteProfession: vi.fn(),
  mockToggleProfession: vi.fn(),
  mockCreateLocation: vi.fn(),
  mockUpdateLocation: vi.fn(),
  mockDeleteLocation: vi.fn(),
  mockToggleLocation: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/auth/context", () => ({
  requireStaffAdmin: () => mocks.mockGuard(),
}));

vi.mock("@/lib/auth/csrf", () => ({
  assertTrustedCsrfFromRequest: () => mocks.mockCsrf(),
  CsrfError: class CsrfError extends Error {},
}));

vi.mock("@/lib/admin/taxonomy", () => ({
  createCategory: (...args: unknown[]) => mocks.mockCreateCategory(...args),
  updateCategory: (...args: unknown[]) => mocks.mockUpdateCategory(...args),
  deleteCategory: (...args: unknown[]) => mocks.mockDeleteCategory(...args),
  toggleCategoryActive: (...args: unknown[]) => mocks.mockToggleCategory(...args),
  createProfession: (...args: unknown[]) => mocks.mockCreateProfession(...args),
  updateProfession: (...args: unknown[]) => mocks.mockUpdateProfession(...args),
  deleteProfession: (...args: unknown[]) => mocks.mockDeleteProfession(...args),
  toggleProfessionActive: (...args: unknown[]) => mocks.mockToggleProfession(...args),
  createLocation: (...args: unknown[]) => mocks.mockCreateLocation(...args),
  updateLocation: (...args: unknown[]) => mocks.mockUpdateLocation(...args),
  deleteLocation: (...args: unknown[]) => mocks.mockDeleteLocation(...args),
  toggleLocationActive: (...args: unknown[]) => mocks.mockToggleLocation(...args),
}));

import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
  toggleCategoryActiveAction,
  createProfessionAction,
  updateProfessionAction,
  deleteProfessionAction,
  toggleProfessionActiveAction,
  createLocationAction,
  updateLocationAction,
  deleteLocationAction,
  toggleLocationActiveAction,
} from "@/app/admin/taxonomy/actions";

const INITIAL: { ok: boolean } = { ok: false };
const VALID_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockGuard.mockResolvedValue({
    ok: true,
    user: { id: "actor-1", email: "admin@example.com", name: "Admin", role: "SUPER_ADMIN" },
  });
  mocks.mockCsrf.mockResolvedValue(true);
  mocks.mockCreateCategory.mockResolvedValue({ ok: true, id: VALID_ID });
  mocks.mockUpdateCategory.mockResolvedValue({ ok: true });
  mocks.mockDeleteCategory.mockResolvedValue({ ok: true, affected: { jobs: 0, professions: 0, children: 0 } });
  mocks.mockToggleCategory.mockResolvedValue({ ok: true, isActive: false });
  mocks.mockCreateProfession.mockResolvedValue({ ok: true, id: VALID_ID });
  mocks.mockUpdateProfession.mockResolvedValue({ ok: true });
  mocks.mockDeleteProfession.mockResolvedValue({ ok: true, affected: { jobs: 0 } });
  mocks.mockToggleProfession.mockResolvedValue({ ok: true, isActive: false });
  mocks.mockCreateLocation.mockResolvedValue({ ok: true, id: VALID_ID });
  mocks.mockUpdateLocation.mockResolvedValue({ ok: true });
  mocks.mockDeleteLocation.mockResolvedValue({ ok: true, affected: { jobs: 0, children: 0 } });
  mocks.mockToggleLocation.mockResolvedValue({ ok: true, isActive: false });
});

function form(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(overrides)) {
    fd.set(k, v);
  }
  return fd;
}

/* -------------------------------------------------------------------------- */
/*  Categories                                                                */
/* -------------------------------------------------------------------------- */

describe("createCategoryAction", () => {
  it("creates a category with correct fields", async () => {
    const result = await createCategoryAction(INITIAL, form({ name: "Test", slug: "test" }));
    expect(result.ok).toBe(true);
    expect(mocks.mockCreateCategory).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Test", slug: "test" }),
      "actor-1",
    );
  });

  it("redirects unauthenticated users to /login", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });
    await expect(createCategoryAction(INITIAL, form({ name: "T", slug: "t" }))).rejects.toThrow("REDIRECT:/login");
  });

  it("rejects MODERATOR mutation", async () => {
    mocks.mockGuard.mockResolvedValue({
      ok: true,
      user: { id: "m1", email: "m@b.com", name: "M", role: "MODERATOR" },
    });
    const result = await createCategoryAction(INITIAL, form({ name: "T", slug: "t" }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("permission");
  });

  it("returns error on CSRF failure", async () => {
    const { CsrfError } = await import("@/lib/auth/csrf");
    mocks.mockCsrf.mockRejectedValue(new CsrfError());
    const result = await createCategoryAction(INITIAL, form({ name: "T", slug: "t" }));
    expect(result.ok).toBe(false);
  });

  it("returns error on missing fields", async () => {
    const result = await createCategoryAction(INITIAL, form({ name: "", slug: "" }));
    expect(result.ok).toBe(false);
  });

  it("returns error on DB failure", async () => {
    mocks.mockCreateCategory.mockRejectedValue(new Error("db down"));
    const result = await createCategoryAction(INITIAL, form({ name: "T", slug: "t" }));
    expect(result.ok).toBe(false);
  });
});

describe("updateCategoryAction", () => {
  it("updates a category", async () => {
    const result = await updateCategoryAction(INITIAL, form({ categoryId: VALID_ID, name: "New" }));
    expect(result.ok).toBe(true);
  });

  it("returns error for invalid id", async () => {
    const result = await updateCategoryAction(INITIAL, form({ categoryId: "bad", name: "N" }));
    expect(result.ok).toBe(false);
  });

  it("returns CYCLE error", async () => {
    mocks.mockUpdateCategory.mockResolvedValue({ ok: false, code: "CYCLE" });
    const result = await updateCategoryAction(INITIAL, form({ categoryId: VALID_ID, parentId: "other-id" }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("cycle");
  });

  it("returns SELF_PARENT error", async () => {
    mocks.mockUpdateCategory.mockResolvedValue({ ok: false, code: "SELF_PARENT" });
    const result = await updateCategoryAction(INITIAL, form({ categoryId: VALID_ID, parentId: VALID_ID }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("own parent");
  });
});

describe("deleteCategoryAction", () => {
  it("deletes a category", async () => {
    const result = await deleteCategoryAction(INITIAL, form({ categoryId: VALID_ID }));
    expect(result.ok).toBe(true);
  });

  it("returns error for invalid id", async () => {
    const result = await deleteCategoryAction(INITIAL, form({ categoryId: "bad" }));
    expect(result.ok).toBe(false);
  });
});

describe("toggleCategoryActiveAction", () => {
  it("toggles category active state", async () => {
    const result = await toggleCategoryActiveAction(INITIAL, form({ categoryId: VALID_ID }));
    expect(result.ok).toBe(true);
  });

  it("returns error for invalid id", async () => {
    const result = await toggleCategoryActiveAction(INITIAL, form({ categoryId: "bad" }));
    expect(result.ok).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/*  Professions                                                               */
/* -------------------------------------------------------------------------- */

describe("createProfessionAction", () => {
  it("creates a profession", async () => {
    const result = await createProfessionAction(INITIAL, form({ name: "Test", slug: "test" }));
    expect(result.ok).toBe(true);
  });

  it("redirects unauthenticated users", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });
    await expect(createProfessionAction(INITIAL, form({ name: "T", slug: "t" }))).rejects.toThrow("REDIRECT:/login");
  });
});

describe("updateProfessionAction", () => {
  it("updates a profession", async () => {
    const result = await updateProfessionAction(INITIAL, form({ professionId: VALID_ID, name: "New" }));
    expect(result.ok).toBe(true);
  });

  it("returns error for invalid id", async () => {
    const result = await updateProfessionAction(INITIAL, form({ professionId: "bad" }));
    expect(result.ok).toBe(false);
  });
});

describe("deleteProfessionAction", () => {
  it("deletes a profession", async () => {
    const result = await deleteProfessionAction(INITIAL, form({ professionId: VALID_ID }));
    expect(result.ok).toBe(true);
  });
});

describe("toggleProfessionActiveAction", () => {
  it("toggles profession active state", async () => {
    const result = await toggleProfessionActiveAction(INITIAL, form({ professionId: VALID_ID }));
    expect(result.ok).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/*  Locations                                                                 */
/* -------------------------------------------------------------------------- */

describe("createLocationAction", () => {
  it("creates a location", async () => {
    const result = await createLocationAction(INITIAL, form({ name: "Test", slug: "test", type: "CITY" }));
    expect(result.ok).toBe(true);
  });

  it("redirects unauthenticated users", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });
    await expect(createLocationAction(INITIAL, form({ name: "T", slug: "t", type: "CITY" }))).rejects.toThrow("REDIRECT:/login");
  });

  it("rejects MODERATOR mutation", async () => {
    mocks.mockGuard.mockResolvedValue({
      ok: true,
      user: { id: "m1", email: "m@b.com", name: "M", role: "MODERATOR" },
    });
    const result = await createLocationAction(INITIAL, form({ name: "T", slug: "t", type: "CITY" }));
    expect(result.ok).toBe(false);
  });
});

describe("updateLocationAction", () => {
  it("updates a location", async () => {
    const result = await updateLocationAction(INITIAL, form({ locationId: VALID_ID, name: "New", type: "CITY" }));
    expect(result.ok).toBe(true);
  });

  it("returns CYCLE error", async () => {
    mocks.mockUpdateLocation.mockResolvedValue({ ok: false, code: "CYCLE" });
    const result = await updateLocationAction(INITIAL, form({ locationId: VALID_ID, parentId: "other-id" }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("cycle");
  });
});

describe("deleteLocationAction", () => {
  it("deletes a location", async () => {
    const result = await deleteLocationAction(INITIAL, form({ locationId: VALID_ID }));
    expect(result.ok).toBe(true);
  });
});

describe("toggleLocationActiveAction", () => {
  it("toggles location active state", async () => {
    const result = await toggleLocationActiveAction(INITIAL, form({ locationId: VALID_ID }));
    expect(result.ok).toBe(true);
  });
});
