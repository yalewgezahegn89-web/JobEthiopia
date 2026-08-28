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
      locations: {
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

vi.mock("../../../db/schema/locations", () => ({
  locations: {
    id: "locations.id",
    name: "locations.name",
    slug: "locations.slug",
    type: "locations.type",
    parentId: "locations.parent_id",
    latitude: "locations.latitude",
    longitude: "locations.longitude",
    isActive: "locations.is_active",
    createdAt: "locations.created_at",
    updatedAt: "locations.updated_at",
  },
}));

import { GET, POST } from "../../../app/api/locations/route";
import {
  GET as GET_BY_ID,
  PUT,
  DELETE,
} from "../../../app/api/locations/[id]/route";

const VALID_ID = "550e8400-e29b-41d4-a716-446655440000";
const PARENT_ID = "110e8400-e29b-41d4-a716-446655440010";

const SAMPLE_LOCATION = {
  id: VALID_ID,
  name: "Addis Ababa",
  slug: "addis-ababa",
  type: "CITY",
  parentId: PARENT_ID,
  latitude: "9.0192",
  longitude: "38.7525",
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
  const url = new URL("http://localhost/api/locations");
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }
  return new Request(url.toString(), { method: "GET" });
}

function makeGetDetailRequest(id: string): Request {
  return new Request(`http://localhost/api/locations/${id}`, {
    method: "GET",
  });
}

function makePostRequest(
  body: unknown,
  headers?: Record<string, string>,
): Request {
  return new Request("http://localhost/api/locations", {
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
  return new Request(`http://localhost/api/locations/${id}`, {
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
  return new Request(`http://localhost/api/locations/${id}`, {
    method: "DELETE",
    headers: {
      "x-api-key": API_KEY,
      ...headers,
    },
  });
}

function mockInsertSuccess(location: Record<string, unknown>) {
  mockDbInsert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([location]),
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
  name: "Addis Ababa",
  slug: "addis-ababa",
  type: "CITY",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDbSuccess(1, [SAMPLE_LOCATION]);
  mockFindFirst.mockResolvedValue(SAMPLE_LOCATION);
});

describe("GET /api/locations", () => {
  describe("successful listing", () => {
    it("returns 200 with location items", async () => {
      const request = makeGetListRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items).toHaveLength(1);
      expect(data.items[0].name).toBe("Addis Ababa");
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
    it("type filter is accepted", async () => {
      const request = makeGetListRequest({ type: "CITY" });
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it("parentId filter is accepted", async () => {
      const request = makeGetListRequest({ parentId: PARENT_ID });
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
    it("invalid type returns 400", async () => {
      const request = makeGetListRequest({ type: "INVALID" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("type");
    });

    it("invalid parentId returns 400", async () => {
      const request = makeGetListRequest({ parentId: "not-a-uuid" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("parentId");
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

describe("POST /api/locations", () => {
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
      const request = makePostRequest({ slug: "test", type: "CITY" });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("name");
    });

    it("missing slug returns 400", async () => {
      const request = makePostRequest({ name: "Test", type: "CITY" });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("slug");
    });

    it("missing type returns 400", async () => {
      const request = makePostRequest({ name: "Test", slug: "test" });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("type");
    });

    it("invalid slug format returns 400", async () => {
      const request = makePostRequest({
        name: "Test",
        slug: "INVALID!",
        type: "CITY",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("slug");
    });

    it("malformed JSON returns 400", async () => {
      const request = new Request("http://localhost/api/locations", {
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
    it("returns 201 with created location", async () => {
      mockInsertSuccess(SAMPLE_LOCATION);

      const request = makePostRequest(VALID_POST_BODY);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.item.name).toBe("Addis Ababa");
    });

    it("response has { item } shape", async () => {
      mockInsertSuccess(SAMPLE_LOCATION);

      const request = makePostRequest(VALID_POST_BODY);
      const response = await POST(request);
      const data = await response.json();

      expect(Object.keys(data)).toEqual(["item"]);
    });

    it("defaults isActive to true", async () => {
      mockInsertSuccess(SAMPLE_LOCATION);

      const request = makePostRequest(VALID_POST_BODY);
      const response = await POST(request);
      const data = await response.json();

      expect(data.item.isActive).toBe(true);
    });

    it("full body with all optional fields returns 201", async () => {
      const fullLocation = {
        ...SAMPLE_LOCATION,
        latitude: "9.0192",
        longitude: "38.7525",
        parentId: PARENT_ID,
      };
      mockInsertSuccess(fullLocation);

      const request = makePostRequest({
        name: "Addis Ababa",
        slug: "addis-ababa",
        type: "CITY",
        parentId: PARENT_ID,
        latitude: 9.0192,
        longitude: 38.7525,
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.item.parentId).toBe(PARENT_ID);
      expect(data.item.latitude).toBe("9.0192");
      expect(data.item.longitude).toBe("38.7525");
    });
  });

  describe("slug conflict", () => {
    it("duplicate slug returns 409", async () => {
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(
            new Error(
              'duplicate key value violates unique constraint "locations_slug_unique"',
            ),
          ),
        }),
      });

      const request = makePostRequest(VALID_POST_BODY);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe("Location slug already exists");
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

describe("GET /api/locations/[id]", () => {
  describe("successful retrieval", () => {
    it("returns 200 with location", async () => {
      const request = makeGetDetailRequest(VALID_ID);
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.item).toBeDefined();
      expect(data.item.id).toBe(VALID_ID);
      expect(data.item.name).toBe("Addis Ababa");
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
      expect(item.name).toBe("Addis Ababa");
      expect(item.slug).toBe("addis-ababa");
      expect(item.type).toBeDefined();
      expect(item.isActive).toBeDefined();
      expect(item.createdAt).toBeDefined();
      expect(item.updatedAt).toBeDefined();
    });
  });

  describe("not found", () => {
    it("returns 404 when location does not exist", async () => {
      mockFindFirst.mockResolvedValue(null);

      const request = makeGetDetailRequest(VALID_ID);
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Location not found");
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
      expect(data.error).toBe("Invalid location ID");
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

describe("PUT /api/locations/[id]", () => {
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
      expect(data.error).toBe("Invalid location ID");
    });

    it("malformed JSON returns 400", async () => {
      const request = new Request(
        `http://localhost/api/locations/${VALID_ID}`,
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

    it("invalid type returns 400", async () => {
      const request = makePutRequest(VALID_ID, { type: "INVALID" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("type");
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
    it("returns 404 when location does not exist", async () => {
      mockFindFirst.mockResolvedValue(null);

      const request = makePutRequest(VALID_ID, { name: "Test" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Location not found");
    });
  });

  describe("successful update", () => {
    it("partial name update returns 200", async () => {
      mockUpdateSuccess({ ...SAMPLE_LOCATION, name: "Renamed City" });

      const request = makePutRequest(VALID_ID, { name: "Renamed City" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.item.name).toBe("Renamed City");
    });

    it("slug update returns 200", async () => {
      mockUpdateSuccess({ ...SAMPLE_LOCATION, slug: "new-slug" });

      const request = makePutRequest(VALID_ID, { slug: "new-slug" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.item.slug).toBe("new-slug");
    });

    it("response has { item } shape", async () => {
      mockUpdateSuccess(SAMPLE_LOCATION);

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
        'duplicate key value violates unique constraint "locations_slug_unique"',
      );

      const request = makePutRequest(VALID_ID, { slug: "existing-slug" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe("Location slug already exists");
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

describe("DELETE /api/locations/[id]", () => {
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
      expect(data.error).toBe("Invalid location ID");
    });
  });

  describe("not found", () => {
    it("returns 404 when location does not exist", async () => {
      mockFindFirst.mockResolvedValue(null);

      const request = makeDeleteRequest(VALID_ID);
      const response = await DELETE(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Location not found");
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

    it("uses correct location ID in delete", async () => {
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
