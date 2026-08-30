import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  mockGuard: vi.fn(),
  mockListCategories: vi.fn(),
  mockGetCategory: vi.fn(),
  mockListProfessions: vi.fn(),
  mockGetProfession: vi.fn(),
  mockListLocations: vi.fn(),
  mockGetLocation: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: (): never => {
    throw new Error("NOT_FOUND");
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

vi.mock("@/lib/auth/context", () => ({
  requireStaffAdmin: () => mocks.mockGuard(),
}));

vi.mock("@/lib/admin/taxonomy", () => ({
  listCategories: (...args: unknown[]) => mocks.mockListCategories(...args),
  getCategory: (...args: unknown[]) => mocks.mockGetCategory(...args),
  listProfessions: (...args: unknown[]) => mocks.mockListProfessions(...args),
  getProfession: (...args: unknown[]) => mocks.mockGetProfession(...args),
  listLocations: (...args: unknown[]) => mocks.mockListLocations(...args),
  getLocation: (...args: unknown[]) => mocks.mockGetLocation(...args),
}));

import AdminTaxonomyPage from "@/app/admin/taxonomy/page";
import AdminCategoriesPage from "@/app/admin/taxonomy/categories/page";
import AdminCategoryDetailPage from "@/app/admin/taxonomy/categories/[id]/page";
import AdminProfessionsPage from "@/app/admin/taxonomy/professions/page";
import AdminProfessionDetailPage from "@/app/admin/taxonomy/professions/[id]/page";
import AdminLocationsPage from "@/app/admin/taxonomy/locations/page";
import AdminLocationDetailPage from "@/app/admin/taxonomy/locations/[id]/page";

const CATEGORY_SUMMARY = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Test Category",
  slug: "test-category",
  description: null,
  parentId: null,
  parentName: null,
  isActive: true,
  sortOrder: 0,
  childCount: 0,
  jobCount: 0,
  professionCount: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const FULL_CATEGORY = {
  ...CATEGORY_SUMMARY,
  description: "Test description",
  children: [],
};

const PROFESSION_SUMMARY = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Test Profession",
  slug: "test-profession",
  description: null,
  categoryId: null,
  categoryName: null,
  isActive: true,
  jobCount: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const FULL_PROFESSION = PROFESSION_SUMMARY;

const LOCATION_SUMMARY = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Test Location",
  slug: "test-location",
  type: "CITY",
  parentId: null,
  parentName: null,
  latitude: null,
  longitude: null,
  isActive: true,
  childCount: 0,
  jobCount: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const FULL_LOCATION = {
  ...LOCATION_SUMMARY,
  children: [],
};

const PAGINATED = (items: unknown[]) => ({
  items,
  page: 1,
  limit: 20,
  total: items.length,
  totalPages: 1,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockGuard.mockResolvedValue({
    ok: true,
    user: { id: "u1", email: "a@b.com", name: "A", role: "SUPER_ADMIN" },
  });
  mocks.mockListCategories.mockResolvedValue(PAGINATED([]));
  mocks.mockGetCategory.mockResolvedValue(null);
  mocks.mockListProfessions.mockResolvedValue(PAGINATED([]));
  mocks.mockGetProfession.mockResolvedValue(null);
  mocks.mockListLocations.mockResolvedValue(PAGINATED([]));
  mocks.mockGetLocation.mockResolvedValue(null);
});

/* -------------------------------------------------------------------------- */
/*  Taxonomy landing page                                                     */
/* -------------------------------------------------------------------------- */

describe("AdminTaxonomyPage", () => {
  it("renders for staff", async () => {
    const element = await AdminTaxonomyPage();
    expect(element).toBeTruthy();
    expect((element as { type: unknown }).type).toBe("div");
  });

  it("redirects unauthenticated to /login", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });
    await expect(AdminTaxonomyPage()).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects non-staff to /admin", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 403 });
    await expect(AdminTaxonomyPage()).rejects.toThrow("REDIRECT:/admin");
  });
});

/* -------------------------------------------------------------------------- */
/*  Categories                                                                */
/* -------------------------------------------------------------------------- */

describe("AdminCategoriesPage", () => {
  it("renders the list for staff", async () => {
    const element = await AdminCategoriesPage({ searchParams: Promise.resolve({}) });
    expect(element).toBeTruthy();
    expect(mocks.mockListCategories).toHaveBeenCalled();
  });

  it("redirects unauthenticated to /login", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });
    await expect(AdminCategoriesPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/login");
  });

  it("renders safe error on load failure", async () => {
    mocks.mockListCategories.mockRejectedValue(new Error("db down"));
    const element = await AdminCategoriesPage({ searchParams: Promise.resolve({}) });
    expect(element).toBeTruthy();
  });

  it("parses filters from search params", async () => {
    mocks.mockListCategories.mockResolvedValue(PAGINATED([]));
    await AdminCategoriesPage({ searchParams: Promise.resolve({ page: "2", isActive: "true", search: "eng" }) });
    expect(mocks.mockListCategories).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, isActive: true, search: "eng" }),
    );
  });
});

describe("AdminCategoryDetailPage", () => {
  it("renders detail for staff", async () => {
    mocks.mockGetCategory.mockResolvedValue(FULL_CATEGORY);
    const element = await AdminCategoryDetailPage({
      params: Promise.resolve({ id: FULL_CATEGORY.id }),
    });
    expect(element).toBeTruthy();
  });

  it("calls notFound for missing category", async () => {
    mocks.mockGetCategory.mockResolvedValue(null);
    await expect(
      AdminCategoryDetailPage({ params: Promise.resolve({ id: FULL_CATEGORY.id }) }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("renders safe error on load failure", async () => {
    mocks.mockGetCategory.mockRejectedValue(new Error("db down"));
    const element = await AdminCategoryDetailPage({
      params: Promise.resolve({ id: FULL_CATEGORY.id }),
    });
    expect(element).toBeTruthy();
  });
});

/* -------------------------------------------------------------------------- */
/*  Professions                                                               */
/* -------------------------------------------------------------------------- */

describe("AdminProfessionsPage", () => {
  it("renders the list for staff", async () => {
    const element = await AdminProfessionsPage({ searchParams: Promise.resolve({}) });
    expect(element).toBeTruthy();
    expect(mocks.mockListProfessions).toHaveBeenCalled();
  });

  it("redirects unauthenticated to /login", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });
    await expect(AdminProfessionsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/login");
  });
});

describe("AdminProfessionDetailPage", () => {
  it("renders detail for staff", async () => {
    mocks.mockGetProfession.mockResolvedValue(FULL_PROFESSION);
    const element = await AdminProfessionDetailPage({
      params: Promise.resolve({ id: FULL_PROFESSION.id }),
    });
    expect(element).toBeTruthy();
  });

  it("calls notFound for missing profession", async () => {
    mocks.mockGetProfession.mockResolvedValue(null);
    await expect(
      AdminProfessionDetailPage({ params: Promise.resolve({ id: FULL_PROFESSION.id }) }),
    ).rejects.toThrow("NOT_FOUND");
  });
});

/* -------------------------------------------------------------------------- */
/*  Locations                                                                 */
/* -------------------------------------------------------------------------- */

describe("AdminLocationsPage", () => {
  it("renders the list for staff", async () => {
    const element = await AdminLocationsPage({ searchParams: Promise.resolve({}) });
    expect(element).toBeTruthy();
    expect(mocks.mockListLocations).toHaveBeenCalled();
  });

  it("redirects unauthenticated to /login", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });
    await expect(AdminLocationsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/login");
  });
});

describe("AdminLocationDetailPage", () => {
  it("renders detail for staff", async () => {
    mocks.mockGetLocation.mockResolvedValue(FULL_LOCATION);
    const element = await AdminLocationDetailPage({
      params: Promise.resolve({ id: FULL_LOCATION.id }),
    });
    expect(element).toBeTruthy();
  });

  it("calls notFound for missing location", async () => {
    mocks.mockGetLocation.mockResolvedValue(null);
    await expect(
      AdminLocationDetailPage({ params: Promise.resolve({ id: FULL_LOCATION.id }) }),
    ).rejects.toThrow("NOT_FOUND");
  });
});
