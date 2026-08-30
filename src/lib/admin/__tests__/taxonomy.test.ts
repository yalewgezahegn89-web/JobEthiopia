import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockCategoriesFindFirst: vi.fn(),
  mockCategoriesFindMany: vi.fn(),
  mockProfessionsFindFirst: vi.fn(),
  mockProfessionsFindMany: vi.fn(),
  mockLocationsFindFirst: vi.fn(),
  mockLocationsFindMany: vi.fn(),
  mockJobsFindMany: vi.fn(),
  mockAuditFindMany: vi.fn(),
  mockUsersSelect: vi.fn(),
  mockCountRows: vi.fn(),
  mockUpdate: vi.fn(),
  mockInsert: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      categories: {
        findFirst: (...args: unknown[]) => mocks.mockCategoriesFindFirst(...args),
        findMany: (...args: unknown[]) => mocks.mockCategoriesFindMany(...args),
      },
      professions: {
        findFirst: (...args: unknown[]) => mocks.mockProfessionsFindFirst(...args),
        findMany: (...args: unknown[]) => mocks.mockProfessionsFindMany(...args),
      },
      locations: {
        findFirst: (...args: unknown[]) => mocks.mockLocationsFindFirst(...args),
        findMany: (...args: unknown[]) => mocks.mockLocationsFindMany(...args),
      },
      jobs: {
        findMany: (...args: unknown[]) => mocks.mockJobsFindMany(...args),
      },
      auditLog: {
        findMany: (...args: unknown[]) => mocks.mockAuditFindMany(...args),
      },
    },
    select: (fields: Record<string, unknown>) => ({
      from: () => ({
        where: (whereArg: unknown) => {
          if (fields && "count" in fields) {
            return Object.assign(mocks.mockCountRows(whereArg), {
              groupBy: () => mocks.mockCountRows(whereArg),
            });
          }
          return mocks.mockUsersSelect(whereArg);
        },
        groupBy: () => mocks.mockCountRows(),
      }),
    }),
    transaction: async (fn: (tx: Record<string, unknown>) => Promise<void>) => {
      const tx = {
        insert: mocks.mockInsert,
        update: mocks.mockUpdate,
        delete: mocks.mockDelete,
      };
      return fn(tx);
    },
    insert: mocks.mockInsert,
    update: mocks.mockUpdate,
    delete: mocks.mockDelete,
  },
}));

vi.mock("@/lib/validations", () => ({
  createCategorySchema: {
    safeParse: (input: unknown) => ({ success: true, data: input }),
  },
  updateCategorySchema: {
    safeParse: (input: unknown) => ({ success: true, data: input }),
  },
  createProfessionSchema: {
    safeParse: (input: unknown) => ({ success: true, data: input }),
  },
  updateProfessionSchema: {
    safeParse: (input: unknown) => ({ success: true, data: input }),
  },
  createLocationSchema: {
    safeParse: (input: unknown) => ({ success: true, data: input }),
  },
  updateLocationSchema: {
    safeParse: (input: unknown) => ({ success: true, data: input }),
  },
}));

import {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryActive,
  listProfessions,
  getProfession,
  createProfession,
  updateProfession,
  deleteProfession,
  toggleProfessionActive,
  listLocations,
  getLocation,
  createLocation,
  updateLocation,
  deleteLocation,
  toggleLocationActive,
  isValidUuid,
} from "@/lib/admin/taxonomy";

const VALID_ID = "11111111-1111-4111-8111-111111111111";
const PARENT_ID = "22222222-2222-4222-8222-222222222222";
const ACTOR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const CATEGORY_ROW = {
  id: VALID_ID,
  name: "Test Category",
  slug: "test-category",
  description: "A test category",
  parentId: null,
  isActive: true,
  sortOrder: 0,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const PROFESSION_ROW = {
  id: VALID_ID,
  name: "Test Profession",
  slug: "test-profession",
  description: "A test profession",
  categoryId: null,
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const LOCATION_ROW = {
  id: VALID_ID,
  name: "Test Location",
  slug: "test-location",
  type: "CITY" as const,
  parentId: null,
  latitude: "9.0",
  longitude: "38.7",
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

function makeTxMocks() {
  const capturedInserts: Record<string, unknown>[] = [];
  const capturedUpdates: Record<string, unknown>[] = [];
  mocks.mockInsert.mockImplementation(() => ({
    values: (vals: Record<string, unknown>) => {
      capturedInserts.push(vals);
      return {
        returning: vi.fn().mockResolvedValue([{ id: VALID_ID }]),
      };
    },
  }));
  mocks.mockUpdate.mockImplementation(() => ({
    set: (values: Record<string, unknown>) => {
      capturedUpdates.push(values);
      return {
        where: vi.fn().mockResolvedValue(undefined),
      };
    },
  }));
  mocks.mockDelete.mockImplementation(() => ({
    where: vi.fn().mockResolvedValue(undefined),
  }));
  return { capturedInserts, capturedUpdates };
}

function collectSqlParams(chunk: unknown): unknown[] {
  const params: unknown[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
    } else if (value && typeof value === "object") {
      if ("value" in value && "encoder" in value) {
        params.push((value as { value: unknown }).value);
      }
      if ("queryChunks" in value) {
        visit((value as { queryChunks: unknown[] }).queryChunks);
      }
    } else if (typeof value === "string") {
      params.push(value);
    }
  };
  visit(chunk);
  return params;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockCountRows.mockResolvedValue([{ count: 0 }]);
  mocks.mockUsersSelect.mockResolvedValue([]);
  mocks.mockDelete.mockImplementation(() => ({
    where: vi.fn().mockResolvedValue(undefined),
  }));
});

describe("isValidUuid", () => {
  it("accepts valid UUID", () => {
    expect(isValidUuid("11111111-1111-4111-8111-111111111111")).toBe(true);
  });
  it("rejects invalid UUID", () => {
    expect(isValidUuid("not-a-uuid")).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/*  Categories                                                                */
/* -------------------------------------------------------------------------- */

describe("listCategories", () => {
  it("returns paginated categories", async () => {
    mocks.mockCategoriesFindMany.mockResolvedValue([CATEGORY_ROW]);
    const result = await listCategories({ page: 1, limit: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(VALID_ID);
  });

  it("applies isActive filter", async () => {
    mocks.mockCategoriesFindMany.mockResolvedValue([]);
    await listCategories({ isActive: true });
    expect(mocks.mockCategoriesFindMany).toHaveBeenCalled();
  });

  it("sanitizes page/limit", async () => {
    mocks.mockCategoriesFindMany.mockResolvedValue([]);
    await listCategories({ page: -1, limit: 200 });
    expect(mocks.mockCategoriesFindMany).toHaveBeenCalled();
  });

  it("filters categories by search at the DB level and counts only matches", async () => {
    mocks.mockCountRows.mockResolvedValue([{ count: 2 }]);
    mocks.mockCategoriesFindMany.mockResolvedValue([CATEGORY_ROW]);

    const result = await listCategories({ search: "Team% _\\Z" });

    const findManyArg = mocks.mockCategoriesFindMany.mock.calls[0][0];
    const resultWhere = findManyArg.where;
    expect(resultWhere).toBeDefined();
    const resultParams = collectSqlParams(resultWhere).map(String);
    expect(resultParams.join(" ")).toContain("%Team\\% \\_\\\\Z%");
    expect(resultParams.join(" ")).not.toContain("Team% _\\Z");

    const countWhere = mocks.mockCountRows.mock.calls[0][0];
    const countParams = collectSqlParams(countWhere).map(String);
    expect(countParams.join(" ")).toContain("%Team\\% \\_\\\\Z%");

    expect(result.total).toBe(2);
  });
});

describe("getCategory", () => {
  it("returns category for valid ID", async () => {
    mocks.mockCategoriesFindFirst.mockResolvedValue(CATEGORY_ROW);
    mocks.mockCategoriesFindMany.mockResolvedValue([]);
    const result = await getCategory(VALID_ID);
    expect(result?.id).toBe(VALID_ID);
  });

  it("returns null for invalid UUID", async () => {
    const result = await getCategory("not-a-uuid");
    expect(result).toBeNull();
  });

  it("returns null when not found", async () => {
    mocks.mockCategoriesFindFirst.mockResolvedValue(null);
    const result = await getCategory(VALID_ID);
    expect(result).toBeNull();
  });
});

describe("createCategory", () => {
  it("inserts a category with correct fields", async () => {
    mocks.mockCategoriesFindFirst.mockResolvedValue(null);
    const { capturedInserts } = makeTxMocks();
    const result = await createCategory({ name: "New", slug: "new" }, ACTOR_ID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.id).toBe(VALID_ID);
    expect(capturedInserts[0].name).toBe("New");
    expect(capturedInserts[0].slug).toBe("new");
  });

  it("inserts audit event CATEGORY_CREATED", async () => {
    mocks.mockCategoriesFindFirst.mockResolvedValue(null);
    const { capturedInserts } = makeTxMocks();
    await createCategory({ name: "C", slug: "c" }, ACTOR_ID);
    const audit = capturedInserts.find((i) => "action" in i);
    expect(audit?.action).toBe("CATEGORY_CREATED");
    expect(audit?.actorUserId).toBe(ACTOR_ID);
  });

  it("returns DUPLICATE on slug conflict", async () => {
    mocks.mockInsert.mockImplementation(() => ({
      values: () => { throw new Error("categories_slug_unique"); },
    }));
    const result = await createCategory({ name: "Dup", slug: "dup" }, ACTOR_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("DUPLICATE");
  });
});

describe("updateCategory", () => {
  it("returns NOT_FOUND for invalid UUID", async () => {
    const result = await updateCategory("bad", { name: "X" }, ACTOR_ID);
    expect(result.ok).toBe(false);
  });

  it("returns NOT_FOUND for nonexistent category", async () => {
    mocks.mockCategoriesFindFirst.mockResolvedValue(null);
    const result = await updateCategory(VALID_ID, { name: "X" }, ACTOR_ID);
    expect(result.ok).toBe(false);
  });

  it("returns true when no fields changed", async () => {
    mocks.mockCategoriesFindFirst.mockResolvedValue({ id: VALID_ID });
    const result = await updateCategory(VALID_ID, {}, ACTOR_ID);
    expect(result.ok).toBe(true);
  });

  it("updates fields and writes audit", async () => {
    mocks.mockCategoriesFindFirst.mockResolvedValue({ id: VALID_ID, name: "Old" });
    const { capturedUpdates, capturedInserts } = makeTxMocks();
    const result = await updateCategory(VALID_ID, { name: "New" }, ACTOR_ID);
    expect(result.ok).toBe(true);
    expect(capturedUpdates[0].name).toBe("New");
    const audit = capturedInserts.find((i) => "action" in i);
    expect(audit?.action).toBe("CATEGORY_UPDATED");
  });

  it("returns SELF_PARENT when setting self as parent", async () => {
    mocks.mockCategoriesFindFirst.mockResolvedValue({ id: VALID_ID });
    const result = await updateCategory(VALID_ID, { parentId: VALID_ID }, ACTOR_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("SELF_PARENT");
  });

  it("returns CYCLE when parent assignment creates cycle", async () => {
    mocks.mockCategoriesFindFirst
      .mockResolvedValueOnce({ id: VALID_ID, name: "Cat" })
      .mockResolvedValueOnce({ id: PARENT_ID, name: "Parent" })
      .mockResolvedValueOnce({ parentId: VALID_ID })
      .mockResolvedValueOnce({ parentId: PARENT_ID });
    const result = await updateCategory(VALID_ID, { parentId: PARENT_ID }, ACTOR_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("CYCLE");
  });
});

describe("deleteCategory", () => {
  it("returns NOT_FOUND for invalid UUID", async () => {
    const result = await deleteCategory("bad", ACTOR_ID);
    expect(result.ok).toBe(false);
  });

  it("deletes and writes audit", async () => {
    mocks.mockCategoriesFindFirst.mockResolvedValueOnce({ id: VALID_ID, name: "Cat" });
    mocks.mockCategoriesFindFirst.mockResolvedValue(null);
    const { capturedInserts } = makeTxMocks();
    const result = await deleteCategory(VALID_ID, ACTOR_ID);
    expect(result.ok).toBe(true);
    const audit = capturedInserts.find((i) => "action" in i);
    expect(audit?.action).toBe("CATEGORY_DELETED");
  });
});

describe("toggleCategoryActive", () => {
  it("toggles active -> inactive", async () => {
    mocks.mockCategoriesFindFirst.mockResolvedValue({ id: VALID_ID, isActive: true });
    const { capturedUpdates } = makeTxMocks();
    const result = await toggleCategoryActive(VALID_ID, ACTOR_ID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.isActive).toBe(false);
    expect(capturedUpdates[0].isActive).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/*  Professions                                                               */
/* -------------------------------------------------------------------------- */

describe("listProfessions", () => {
  it("returns paginated professions", async () => {
    mocks.mockProfessionsFindMany.mockResolvedValue([PROFESSION_ROW]);
    const result = await listProfessions({ page: 1, limit: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(VALID_ID);
  });

  it("filters professions by search at the DB level and counts only matches", async () => {
    mocks.mockCountRows.mockResolvedValue([{ count: 3 }]);
    mocks.mockProfessionsFindMany.mockResolvedValue([PROFESSION_ROW]);

    const result = await listProfessions({ search: "Nurse% _\\X" });

    const findManyArg = mocks.mockProfessionsFindMany.mock.calls[0][0];
    const resultWhere = findManyArg.where;
    expect(resultWhere).toBeDefined();
    const resultParams = collectSqlParams(resultWhere).map(String);
    expect(resultParams.join(" ")).toContain("%Nurse\\% \\_\\\\X%");
    expect(resultParams.join(" ")).not.toContain("Nurse% _\\X");

    const countWhere = mocks.mockCountRows.mock.calls[0][0];
    const countParams = collectSqlParams(countWhere).map(String);
    expect(countParams.join(" ")).toContain("%Nurse\\% \\_\\\\X%");

    expect(result.total).toBe(3);
  });
});

describe("getProfession", () => {
  it("returns profession for valid ID", async () => {
    mocks.mockProfessionsFindFirst.mockResolvedValue(PROFESSION_ROW);
    const result = await getProfession(VALID_ID);
    expect(result?.id).toBe(VALID_ID);
  });

  it("returns null for invalid UUID", async () => {
    const result = await getProfession("not-a-uuid");
    expect(result).toBeNull();
  });
});

describe("createProfession", () => {
  it("inserts a profession", async () => {
    mocks.mockProfessionsFindFirst.mockResolvedValue(null);
    const { capturedInserts } = makeTxMocks();
    const result = await createProfession({ name: "New", slug: "new" }, ACTOR_ID);
    expect(result.ok).toBe(true);
    expect(capturedInserts[0].name).toBe("New");
  });

  it("returns DUPLICATE on slug conflict", async () => {
    mocks.mockInsert.mockImplementation(() => ({
      values: () => { throw new Error("professions_slug_unique"); },
    }));
    const result = await createProfession({ name: "Dup", slug: "dup" }, ACTOR_ID);
    expect(result.ok).toBe(false);
  });
});

describe("updateProfession", () => {
  it("returns NOT_FOUND for invalid UUID", async () => {
    const result = await updateProfession("bad", { name: "X" }, ACTOR_ID);
    expect(result.ok).toBe(false);
  });

  it("returns NOT_FOUND for nonexistent profession", async () => {
    mocks.mockProfessionsFindFirst.mockResolvedValue(null);
    const result = await updateProfession(VALID_ID, { name: "X" }, ACTOR_ID);
    expect(result.ok).toBe(false);
  });

  it("updates and writes audit", async () => {
    mocks.mockProfessionsFindFirst.mockResolvedValue({ id: VALID_ID });
    const { capturedUpdates, capturedInserts } = makeTxMocks();
    const result = await updateProfession(VALID_ID, { name: "New" }, ACTOR_ID);
    expect(result.ok).toBe(true);
    expect(capturedUpdates[0].name).toBe("New");
    const audit = capturedInserts.find((i) => "action" in i);
    expect(audit?.action).toBe("PROFESSION_UPDATED");
  });
});

describe("deleteProfession", () => {
  it("deletes and writes audit", async () => {
    mocks.mockProfessionsFindFirst.mockResolvedValue({ id: VALID_ID, name: "Prof" });
    const { capturedInserts } = makeTxMocks();
    const result = await deleteProfession(VALID_ID, ACTOR_ID);
    expect(result.ok).toBe(true);
    const audit = capturedInserts.find((i) => "action" in i);
    expect(audit?.action).toBe("PROFESSION_DELETED");
  });
});

describe("toggleProfessionActive", () => {
  it("toggles active -> inactive", async () => {
    mocks.mockProfessionsFindFirst.mockResolvedValue({ id: VALID_ID, isActive: true });
    const { capturedUpdates } = makeTxMocks();
    const result = await toggleProfessionActive(VALID_ID, ACTOR_ID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.isActive).toBe(false);
    expect(capturedUpdates[0].isActive).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/*  Locations                                                                 */
/* -------------------------------------------------------------------------- */

describe("listLocations", () => {
  it("returns paginated locations", async () => {
    mocks.mockLocationsFindMany.mockResolvedValue([LOCATION_ROW]);
    const result = await listLocations({ page: 1, limit: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(VALID_ID);
  });

  it("filters locations by search at the DB level and counts only matches", async () => {
    mocks.mockCountRows.mockResolvedValue([{ count: 4 }]);
    mocks.mockLocationsFindMany.mockResolvedValue([LOCATION_ROW]);

    const result = await listLocations({ search: "Addis% _\\A" });

    const findManyArg = mocks.mockLocationsFindMany.mock.calls[0][0];
    const resultWhere = findManyArg.where;
    expect(resultWhere).toBeDefined();
    const resultParams = collectSqlParams(resultWhere).map(String);
    expect(resultParams.join(" ")).toContain("%Addis\\% \\_\\\\A%");
    expect(resultParams.join(" ")).not.toContain("Addis% _\\A");

    const countWhere = mocks.mockCountRows.mock.calls[0][0];
    const countParams = collectSqlParams(countWhere).map(String);
    expect(countParams.join(" ")).toContain("%Addis\\% \\_\\\\A%");

    expect(result.total).toBe(4);
  });
});

describe("getLocation", () => {
  it("returns location for valid ID", async () => {
    mocks.mockLocationsFindFirst.mockResolvedValue(LOCATION_ROW);
    const result = await getLocation(VALID_ID);
    expect(result?.id).toBe(VALID_ID);
  });

  it("returns null for invalid UUID", async () => {
    const result = await getLocation("not-a-uuid");
    expect(result).toBeNull();
  });
});

describe("createLocation", () => {
  it("inserts a location", async () => {
    mocks.mockLocationsFindFirst.mockResolvedValue(null);
    const { capturedInserts } = makeTxMocks();
    const result = await createLocation(
      { name: "New", slug: "new", type: "CITY" },
      ACTOR_ID,
    );
    expect(result.ok).toBe(true);
    expect(capturedInserts[0].name).toBe("New");
    expect(capturedInserts[0].type).toBe("CITY");
  });

  it("returns DUPLICATE on slug conflict", async () => {
    mocks.mockInsert.mockImplementation(() => ({
      values: () => { throw new Error("locations_slug_unique"); },
    }));
    const result = await createLocation({ name: "Dup", slug: "dup", type: "CITY" }, ACTOR_ID);
    expect(result.ok).toBe(false);
  });
});

describe("updateLocation", () => {
  it("returns NOT_FOUND for invalid UUID", async () => {
    const result = await updateLocation("bad", { name: "X" }, ACTOR_ID);
    expect(result.ok).toBe(false);
  });

  it("returns SELF_PARENT when setting self as parent", async () => {
    mocks.mockLocationsFindFirst.mockResolvedValue({ id: VALID_ID });
    const result = await updateLocation(VALID_ID, { parentId: VALID_ID }, ACTOR_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("SELF_PARENT");
  });

  it("returns CYCLE when parent assignment creates cycle", async () => {
    mocks.mockLocationsFindFirst
      .mockResolvedValueOnce({ id: VALID_ID })
      .mockResolvedValueOnce({ id: PARENT_ID, name: "Parent" })
      .mockResolvedValueOnce({ parentId: VALID_ID })
      .mockResolvedValueOnce({ parentId: PARENT_ID });
    const result = await updateLocation(VALID_ID, { parentId: PARENT_ID }, ACTOR_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("CYCLE");
  });

  it("updates and writes audit", async () => {
    mocks.mockLocationsFindFirst.mockResolvedValue({ id: VALID_ID });
    const { capturedUpdates, capturedInserts } = makeTxMocks();
    const result = await updateLocation(VALID_ID, { name: "New" }, ACTOR_ID);
    expect(result.ok).toBe(true);
    expect(capturedUpdates[0].name).toBe("New");
    const audit = capturedInserts.find((i) => "action" in i);
    expect(audit?.action).toBe("LOCATION_UPDATED");
  });
});

describe("deleteLocation", () => {
  it("deletes and writes audit", async () => {
    mocks.mockLocationsFindFirst.mockResolvedValue({ id: VALID_ID, name: "Loc" });
    const { capturedInserts } = makeTxMocks();
    const result = await deleteLocation(VALID_ID, ACTOR_ID);
    expect(result.ok).toBe(true);
    const audit = capturedInserts.find((i) => "action" in i);
    expect(audit?.action).toBe("LOCATION_DELETED");
  });
});

describe("toggleLocationActive", () => {
  it("toggles active -> inactive", async () => {
    mocks.mockLocationsFindFirst.mockResolvedValue({ id: VALID_ID, isActive: true });
    const { capturedUpdates } = makeTxMocks();
    const result = await toggleLocationActive(VALID_ID, ACTOR_ID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.isActive).toBe(false);
    expect(capturedUpdates[0].isActive).toBe(false);
  });
});
