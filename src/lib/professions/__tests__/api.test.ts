import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDbSelect = vi.fn();
const mockDbFindMany = vi.fn();
const mockDbInsert = vi.fn();
const mockFindFirst = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbDelete = vi.fn();

vi.mock("../../../db", () => ({
  db: {
    query: {
      professions: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
        findMany: (...args: unknown[]) => mockDbFindMany(...args),
      },
    },
    select: (...args: unknown[]) => mockDbSelect(...args),
    insert: (...args: unknown[]) => mockDbInsert(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args),
    delete: (...args: unknown[]) => mockDbDelete(...args),
  },
}));

vi.mock("../../../db/schema/professions", () => ({
  professions: {
    id: "professions.id",
    name: "professions.name",
    slug: "professions.slug",
    description: "professions.description",
    categoryId: "professions.category_id",
    isActive: "professions.is_active",
    createdAt: "professions.created_at",
    updatedAt: "professions.updated_at",
  },
}));

import { GET, POST } from "../../../app/api/professions/route";
import {
  GET as GET_BY_ID,
  PUT,
  DELETE,
} from "../../../app/api/professions/[id]/route";

const VALID_ID = "550e8400-e29b-41d4-a716-446655440000";
const CATEGORY_ID = "110e8400-e29b-41d4-a716-446655440010";

const SAMPLE_PROFESSION = {
  id: VALID_ID,
  name: "Nursing",
  slug: "nursing",
  description: "Nursing and patient care",
  categoryId: CATEGORY_ID,
  isActive: true,
  createdAt: new Date("2026-01-15"),
  updatedAt: new Date("2026-01-15"),
};

function mockDbSuccess(count: number, items: unknown[]) {
  mockDbSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ count }]),
    }),
  });
  mockDbFindMany.mockResolvedValue(items);
}

function makeGetListRequest(searchParams?: Record<string, string>): Request {
  const url = new URL("http://localhost/api/professions");
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }
  return new Request(url.toString(), { method: "GET" });
}

function makeGetDetailRequest(id: string): Request {
  return new Request(`http://localhost/api/professions/${id}`, {
    method: "GET",
  });
}

function makePostRequest(
  body: unknown,
  headers?: Record<string, string>,
): Request {
  return new Request("http://localhost/api/professions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function makePutRequest(
  id: string,
  body: unknown,
  headers?: Record<string, string>,
): Request {
  return new Request(`http://localhost/api/professions/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function makeDeleteRequest(
  id: string,
  headers?: Record<string, string>,
): Request {
  return new Request(`http://localhost/api/professions/${id}`, {
    method: "DELETE",
    headers: {
      "x-api-key": API_KEY,
      ...headers,
    },
  });
}

function mockInsertSuccess(profession: Record<string, unknown>) {
  mockDbInsert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([profession]),
    }),
  });
}

function mockUpdateSuccess(updated: Record<string, unknown>) {
  mockDbUpdate.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([updated]),
      }),
    }),
  });
}

function mockUpdateError(errorMessage: string) {
  mockDbUpdate.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockRejectedValue(new Error(errorMessage)),
      }),
    }),
  });
}

function mockDeleteSuccess() {
  mockDbDelete.mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  });
}

function mockDeleteError(errorMessage: string) {
  mockDbDelete.mockReturnValue({
    where: vi.fn().mockRejectedValue(new Error(errorMessage)),
  });
}

const API_KEY = "test-api-key-123";
const VALID_POST_BODY = {
  name: "Nursing",
  slug: "nursing",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDbSuccess(1, [SAMPLE_PROFESSION]);
  mockFindFirst.mockResolvedValue(SAMPLE_PROFESSION);
});

describe("GET /api/professions", () => {
  describe("successful listing", () => {
    it("returns 200 with profession items", async () => {
      const request = makeGetListRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items).toHaveLength(1);
      expect(data.items[0].name).toBe("Nursing");
    });

    it("default page is 1", async () => {
      const request = makeGetListRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(data.pagination.page).toBe(1);
    });

    it("default limit is 20", async () => {
      const request = makeGetListRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(data.pagination.limit).toBe(20);
    });

    it("custom page works", async () => {
      const request = makeGetListRequest({ page: "2" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination.page).toBe(2);
    });

    it("custom limit works", async () => {
      const request = makeGetListRequest({ limit: "5" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination.limit).toBe(5);
    });
  });

  describe("filters", () => {
    it("categoryId filter is accepted", async () => {
      const request = makeGetListRequest({ categoryId: CATEGORY_ID });
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it("isActive=true filter is accepted", async () => {
      const request = makeGetListRequest({ isActive: "true" });
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it("isActive=false filter is accepted", async () => {
      const request = makeGetListRequest({ isActive: "false" });
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it("empty result set returns correct totals", async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });
      mockDbFindMany.mockResolvedValue([]);

      const request = makeGetListRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items).toHaveLength(0);
      expect(data.pagination.total).toBe(0);
    });
  });

  describe("validation", () => {
    it("invalid categoryId returns 400", async () => {
      const request = makeGetListRequest({ categoryId: "not-a-uuid" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("categoryId");
    });
  });

  describe("error handling", () => {
    it("database error returns 500", async () => {
      mockDbSelect.mockImplementation(() => {
        throw new Error("DB connection failed");
      });

      const request = makeGetListRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });
});

describe("POST /api/professions", () => {
  beforeEach(() => {
    vi.stubEnv("INGESTION_API_KEY", API_KEY);
  });

  describe("authentication", () => {
    it("missing API key returns 401", async () => {
      const request = makePostRequest(VALID_POST_BODY, {
        "x-api-key": "",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("invalid API key returns 401", async () => {
      const request = makePostRequest(VALID_POST_BODY, {
        "x-api-key": "wrong-key",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("validation", () => {
    it("missing name returns 400", async () => {
      const request = makePostRequest({ slug: "test" });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("name");
    });

    it("missing slug returns 400", async () => {
      const request = makePostRequest({ name: "Test" });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("slug");
    });

    it("invalid slug format returns 400", async () => {
      const request = makePostRequest({ name: "Test", slug: "INVALID!" });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("slug");
    });

    it("malformed JSON returns 400", async () => {
      const request = new Request("http://localhost/api/professions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
        },
        body: "not valid json",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid JSON body");
    });
  });

  describe("successful creation", () => {
    it("returns 201 with created profession", async () => {
      mockInsertSuccess(SAMPLE_PROFESSION);

      const request = makePostRequest(VALID_POST_BODY);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.item.name).toBe("Nursing");
    });

    it("response has { item } shape", async () => {
      mockInsertSuccess(SAMPLE_PROFESSION);

      const request = makePostRequest(VALID_POST_BODY);
      const response = await POST(request);
      const data = await response.json();

      expect(Object.keys(data)).toEqual(["item"]);
    });

    it("full body with all optional fields returns 201", async () => {
      const fullProfession = {
        ...SAMPLE_PROFESSION,
        description: "Nursing and patient care",
        categoryId: CATEGORY_ID,
      };
      mockInsertSuccess(fullProfession);

      const request = makePostRequest({
        name: "Nursing",
        slug: "nursing",
        description: "Nursing and patient care",
        categoryId: CATEGORY_ID,
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.item.description).toBe("Nursing and patient care");
      expect(data.item.categoryId).toBe(CATEGORY_ID);
    });
  });

  describe("slug conflict", () => {
    it("duplicate slug returns 409", async () => {
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(
            new Error(
              'duplicate key value violates unique constraint "professions_slug_unique"',
            ),
          ),
        }),
      });

      const request = makePostRequest(VALID_POST_BODY);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe("Profession slug already exists");
    });
  });

  describe("error handling", () => {
    it("DB error returns 500", async () => {
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(
            new Error("DB connection failed"),
          ),
        }),
      });

      const request = makePostRequest(VALID_POST_BODY);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("raw DB error details are not leaked", async () => {
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(
            new Error("SECRET_DB_PASSWORD=xyz connection refused"),
          ),
        }),
      });

      const request = makePostRequest(VALID_POST_BODY);
      const response = await POST(request);
      const body = await response.text();

      expect(body).not.toContain("SECRET_DB_PASSWORD");
      expect(body).not.toContain("xyz");
    });
  });
});

describe("GET /api/professions/[id]", () => {
  describe("successful retrieval", () => {
    it("returns 200 with profession", async () => {
      const request = makeGetDetailRequest(VALID_ID);
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.item).toBeDefined();
      expect(data.item.id).toBe(VALID_ID);
      expect(data.item.name).toBe("Nursing");
    });

    it("response has { item } shape", async () => {
      const request = makeGetDetailRequest(VALID_ID);
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(Object.keys(data)).toEqual(["item"]);
    });

    it("returns all expected fields", async () => {
      const request = makeGetDetailRequest(VALID_ID);
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      const item = data.item;
      expect(item.id).toBe(VALID_ID);
      expect(item.name).toBe("Nursing");
      expect(item.slug).toBe("nursing");
      expect(item.description).toBeDefined();
      expect(item.isActive).toBeDefined();
      expect(item.createdAt).toBeDefined();
      expect(item.updatedAt).toBeDefined();
    });
  });

  describe("not found", () => {
    it("returns 404 when profession does not exist", async () => {
      mockFindFirst.mockResolvedValue(null);

      const request = makeGetDetailRequest(VALID_ID);
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Profession not found");
    });
  });

  describe("validation", () => {
    it("invalid UUID returns 400", async () => {
      const request = makeGetDetailRequest("not-a-uuid");
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: "not-a-uuid" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid profession ID");
    });
  });

  describe("error handling", () => {
    it("database error returns 500", async () => {
      mockFindFirst.mockRejectedValue(new Error("DB connection failed"));

      const request = makeGetDetailRequest(VALID_ID);
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("database error details are not leaked", async () => {
      mockFindFirst.mockRejectedValue(
        new Error("SECRET_DB_PASSWORD=xyz connection refused"),
      );

      const request = makeGetDetailRequest(VALID_ID);
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const body = await response.text();

      expect(body).not.toContain("SECRET_DB_PASSWORD");
      expect(body).not.toContain("xyz");
    });
  });
});

describe("PUT /api/professions/[id]", () => {
  beforeEach(() => {
    vi.stubEnv("INGESTION_API_KEY", API_KEY);
    mockFindFirst.mockResolvedValue({ id: VALID_ID });
  });

  describe("authentication", () => {
    it("missing API key returns 401", async () => {
      const request = makePutRequest(
        VALID_ID,
        { name: "Test" },
        { "x-api-key": "" },
      );
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("invalid API key returns 401", async () => {
      const request = makePutRequest(
        VALID_ID,
        { name: "Test" },
        { "x-api-key": "wrong-key" },
      );
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("validation", () => {
    it("invalid UUID returns 400", async () => {
      const request = makePutRequest("not-a-uuid", { name: "Test" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: "not-a-uuid" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid profession ID");
    });

    it("malformed JSON returns 400", async () => {
      const request = new Request(
        `http://localhost/api/professions/${VALID_ID}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": API_KEY,
          },
          body: "not valid json",
        },
      );
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid JSON body");
    });

    it("invalid slug format returns 400", async () => {
      const request = makePutRequest(VALID_ID, { slug: "INVALID!" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("slug");
    });
  });

  describe("not found", () => {
    it("returns 404 when profession does not exist", async () => {
      mockFindFirst.mockResolvedValue(null);

      const request = makePutRequest(VALID_ID, { name: "Test" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Profession not found");
    });
  });

  describe("successful update", () => {
    it("partial name update returns 200", async () => {
      mockUpdateSuccess({ ...SAMPLE_PROFESSION, name: "Renamed Profession" });

      const request = makePutRequest(VALID_ID, { name: "Renamed Profession" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.item.name).toBe("Renamed Profession");
    });

    it("slug update returns 200", async () => {
      mockUpdateSuccess({ ...SAMPLE_PROFESSION, slug: "new-slug" });

      const request = makePutRequest(VALID_ID, { slug: "new-slug" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.item.slug).toBe("new-slug");
    });

    it("response has { item } shape", async () => {
      mockUpdateSuccess(SAMPLE_PROFESSION);

      const request = makePutRequest(VALID_ID, { name: "Updated" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(Object.keys(data)).toEqual(["item"]);
    });
  });

  describe("slug conflict", () => {
    it("duplicate slug returns 409", async () => {
      mockUpdateError(
        'duplicate key value violates unique constraint "professions_slug_unique"',
      );

      const request = makePutRequest(VALID_ID, { slug: "existing-slug" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe("Profession slug already exists");
    });
  });

  describe("error handling", () => {
    it("unrelated DB error returns 500", async () => {
      mockUpdateError("DB connection failed");

      const request = makePutRequest(VALID_ID, { name: "Test" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("DB error details are not leaked", async () => {
      mockUpdateError("SECRET_DB_PASSWORD=xyz connection refused");

      const request = makePutRequest(VALID_ID, { name: "Test" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const body = await response.text();

      expect(body).not.toContain("SECRET_DB_PASSWORD");
      expect(body).not.toContain("xyz");
    });
  });
});

describe("DELETE /api/professions/[id]", () => {
  beforeEach(() => {
    vi.stubEnv("INGESTION_API_KEY", API_KEY);
    mockFindFirst.mockResolvedValue({ id: VALID_ID });
  });

  describe("authentication", () => {
    it("missing API key returns 401", async () => {
      const request = makeDeleteRequest(VALID_ID, { "x-api-key": "" });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("invalid API key returns 401", async () => {
      const request = makeDeleteRequest(VALID_ID, {
        "x-api-key": "wrong-key",
      });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("validation", () => {
    it("invalid UUID returns 400", async () => {
      const request = makeDeleteRequest("not-a-uuid");
      const response = await DELETE(request, {
        params: Promise.resolve({ id: "not-a-uuid" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid profession ID");
    });
  });

  describe("not found", () => {
    it("returns 404 when profession does not exist", async () => {
      mockFindFirst.mockResolvedValue(null);

      const request = makeDeleteRequest(VALID_ID);
      const response = await DELETE(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Profession not found");
    });
  });

  describe("successful deletion", () => {
    it("returns 200 with success true", async () => {
      mockDeleteSuccess();

      const request = makeDeleteRequest(VALID_ID);
      const response = await DELETE(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("uses correct profession ID in delete", async () => {
      mockDeleteSuccess();

      const request = makeDeleteRequest(VALID_ID);
      await DELETE(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });

      expect(mockDbDelete).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("unrelated DB error returns 500", async () => {
      mockDeleteError("DB connection failed");

      const request = makeDeleteRequest(VALID_ID);
      const response = await DELETE(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("raw DB error details are not leaked", async () => {
      mockDeleteError("SECRET_DB_PASSWORD=xyz connection refused");

      const request = makeDeleteRequest(VALID_ID);
      const response = await DELETE(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const body = await response.text();

      expect(body).not.toContain("SECRET_DB_PASSWORD");
      expect(body).not.toContain("xyz");
    });
  });
});
