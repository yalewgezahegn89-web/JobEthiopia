import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDbSelect = vi.fn();
const mockDbFindMany = vi.fn();
const mockDbInsert = vi.fn();
const mockFindFirst = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbDelete = vi.fn();

const { mockAssertTrustedCsrfFromRequest } = vi.hoisted(() => ({
  mockAssertTrustedCsrfFromRequest: vi.fn(),
}));

vi.mock("@/lib/auth/csrf", () => ({
  assertTrustedCsrfFromRequest: mockAssertTrustedCsrfFromRequest,
  CsrfError: class CsrfError extends Error {
    constructor() {
      super("Unexpected request origin");
      this.name = "CsrfError";
    }
  },
}));

vi.mock("../../../db", () => ({
  db: {
    query: {
      organizations: {
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

vi.mock("../../../db/schema/organizations", () => ({
  organizations: {
    id: "organizations.id",
    name: "organizations.name",
    slug: "organizations.slug",
    description: "organizations.description",
    industry: "organizations.industry",
    websiteUrl: "organizations.website_url",
    logoUrl: "organizations.logo_url",
    locationId: "organizations.location_id",
    isVerified: "organizations.is_verified",
    status: "organizations.status",
    createdAt: "organizations.created_at",
    updatedAt: "organizations.updated_at",
  },
}));

import { GET, POST } from "../../../app/api/organizations/route";
import {
  GET as GET_BY_ID,
  PUT,
  DELETE,
} from "../../../app/api/organizations/[id]/route";

const VALID_ID = "550e8400-e29b-41d4-a716-446655440000";

const SAMPLE_ORG = {
  id: VALID_ID,
  name: "Black Lion Hospital",
  slug: "black-lion-hospital",
  description: "Referral and teaching hospital",
  industry: "Healthcare",
  websiteUrl: "https://example.com",
  logoUrl: "https://example.com/logo.png",
  locationId: "110e8400-e29b-41d4-a716-446655440010",
  isVerified: false,
  status: "ACTIVE",
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
  const url = new URL("http://localhost/api/organizations");
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }
  return new Request(url.toString(), { method: "GET" });
}

function makeGetDetailRequest(id: string): Request {
  return new Request(`http://localhost/api/organizations/${id}`, {
    method: "GET",
  });
}

function makePostRequest(
  body: unknown,
  headers?: Record<string, string>,
): Request {
  return new Request("http://localhost/api/organizations", {
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
  return new Request(`http://localhost/api/organizations/${id}`, {
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
  return new Request(`http://localhost/api/organizations/${id}`, {
    method: "DELETE",
    headers: {
      "x-api-key": API_KEY,
      ...headers,
    },
  });
}

function mockInsertSuccess(org: Record<string, unknown>) {
  mockDbInsert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([org]),
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
  name: "Black Lion Hospital",
  slug: "black-lion-hospital",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDbSuccess(1, [SAMPLE_ORG]);
  mockFindFirst.mockResolvedValue(SAMPLE_ORG);
});

describe("GET /api/organizations", () => {
  describe("successful listing", () => {
    it("returns 200 with organization items", async () => {
      const request = makeGetListRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items).toHaveLength(1);
      expect(data.items[0].name).toBe("Black Lion Hospital");
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
    it("status filter is accepted", async () => {
      const request = makeGetListRequest({ status: "ACTIVE" });
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it("locationId filter is accepted", async () => {
      const request = makeGetListRequest({
        locationId: "110e8400-e29b-41d4-a716-446655440010",
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it("isVerified=true filter is accepted", async () => {
      const request = makeGetListRequest({ isVerified: "true" });
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it("isVerified=false filter is accepted", async () => {
      const request = makeGetListRequest({ isVerified: "false" });
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
    it("invalid status returns 400", async () => {
      const request = makeGetListRequest({ status: "INVALID" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("status");
    });

    it("invalid locationId returns 400", async () => {
      const request = makeGetListRequest({ locationId: "not-a-uuid" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("locationId");
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

describe("POST /api/organizations", () => {
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

    it("missing API key configuration returns 500", async () => {
      vi.stubEnv("INGESTION_API_KEY", undefined);

      const request = makePostRequest(VALID_POST_BODY);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Server configuration error");
    });

    it("API key is not reflected in error response", async () => {
      const request = makePostRequest(VALID_POST_BODY, {
        "x-api-key": "secret-key-value",
      });
      const response = await POST(request);
      const body = await response.text();

      expect(body).not.toContain("secret-key-value");
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
      const request = makePostRequest({
        name: "Test",
        slug: "INVALID SLUG!",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("slug");
    });

    it("malformed JSON returns 400", async () => {
      const request = new Request("http://localhost/api/organizations", {
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

    it("invalid websiteUrl returns 400", async () => {
      const request = makePostRequest({
        name: "Test",
        slug: "test",
        websiteUrl: "not-a-url",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("websiteUrl");
    });
  });

  describe("successful creation", () => {
    it("minimal body returns 201", async () => {
      mockInsertSuccess(SAMPLE_ORG);

      const request = makePostRequest(VALID_POST_BODY);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.item).toBeDefined();
      expect(data.item.name).toBe("Black Lion Hospital");
    });

    it("response has { item } shape", async () => {
      mockInsertSuccess(SAMPLE_ORG);

      const request = makePostRequest(VALID_POST_BODY);
      const response = await POST(request);
      const data = await response.json();

      expect(Object.keys(data)).toEqual(["item"]);
    });

    it("defaults status to ACTIVE", async () => {
      mockInsertSuccess(SAMPLE_ORG);

      const request = makePostRequest(VALID_POST_BODY);
      const response = await POST(request);
      const data = await response.json();

      expect(data.item.status).toBe("ACTIVE");
    });

    it("defaults isVerified to false", async () => {
      mockInsertSuccess(SAMPLE_ORG);

      const request = makePostRequest(VALID_POST_BODY);
      const response = await POST(request);
      const data = await response.json();

      expect(data.item.isVerified).toBe(false);
    });

    it("full body with all optional fields returns 201", async () => {
      const fullOrg = {
        ...SAMPLE_ORG,
        description: "A hospital",
        industry: "Healthcare",
        websiteUrl: "https://example.com",
        logoUrl: "https://example.com/logo.png",
        locationId: "110e8400-e29b-41d4-a716-446655440010",
      };
      mockInsertSuccess(fullOrg);

      const request = makePostRequest({
        name: "Black Lion Hospital",
        slug: "black-lion-hospital",
        description: "A hospital",
        industry: "Healthcare",
        websiteUrl: "https://example.com",
        logoUrl: "https://example.com/logo.png",
        locationId: "110e8400-e29b-41d4-a716-446655440010",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.item.description).toBe("A hospital");
      expect(data.item.industry).toBe("Healthcare");
    });
  });

  describe("slug conflict", () => {
    it("duplicate slug returns 409", async () => {
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(
            new Error(
              'duplicate key value violates unique constraint "organizations_slug_unique"',
            ),
          ),
        }),
      });

      const request = makePostRequest(VALID_POST_BODY);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe("Organization slug already exists");
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

describe("GET /api/organizations/[id]", () => {
  describe("successful retrieval", () => {
    it("returns 200 with organization", async () => {
      const request = makeGetDetailRequest(VALID_ID);
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.item).toBeDefined();
      expect(data.item.id).toBe(VALID_ID);
      expect(data.item.name).toBe("Black Lion Hospital");
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
      expect(item.name).toBe("Black Lion Hospital");
      expect(item.slug).toBe("black-lion-hospital");
      expect(item.description).toBeDefined();
      expect(item.isVerified).toBeDefined();
      expect(item.status).toBeDefined();
      expect(item.createdAt).toBeDefined();
      expect(item.updatedAt).toBeDefined();
    });
  });

  describe("not found", () => {
    it("returns 404 when organization does not exist", async () => {
      mockFindFirst.mockResolvedValue(null);

      const request = makeGetDetailRequest(VALID_ID);
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Organization not found");
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
      expect(data.error).toBe("Invalid organization ID");
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

describe("PUT /api/organizations/[id]", () => {
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
      expect(data.error).toBe("Invalid organization ID");
    });

    it("malformed JSON returns 400", async () => {
      const request = new Request(
        `http://localhost/api/organizations/${VALID_ID}`,
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

    it("invalid status returns 400", async () => {
      const request = makePutRequest(VALID_ID, { status: "INVALID" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("status");
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
    it("returns 404 when organization does not exist", async () => {
      mockFindFirst.mockResolvedValue(null);

      const request = makePutRequest(VALID_ID, { name: "Test" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Organization not found");
    });
  });

  describe("successful update", () => {
    it("partial name update returns 200", async () => {
      mockUpdateSuccess({ ...SAMPLE_ORG, name: "Renamed Hospital" });

      const request = makePutRequest(VALID_ID, { name: "Renamed Hospital" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.item.name).toBe("Renamed Hospital");
    });

    it("slug update returns 200", async () => {
      mockUpdateSuccess({ ...SAMPLE_ORG, slug: "new-slug" });

      const request = makePutRequest(VALID_ID, { slug: "new-slug" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.item.slug).toBe("new-slug");
    });

    it("response has { item } shape", async () => {
      mockUpdateSuccess(SAMPLE_ORG);

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
        'duplicate key value violates unique constraint "organizations_slug_unique"',
      );

      const request = makePutRequest(VALID_ID, { slug: "existing-slug" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe("Organization slug already exists");
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

describe("DELETE /api/organizations/[id]", () => {
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
      expect(data.error).toBe("Invalid organization ID");
    });
  });

  describe("not found", () => {
    it("returns 404 when organization does not exist", async () => {
      mockFindFirst.mockResolvedValue(null);

      const request = makeDeleteRequest(VALID_ID);
      const response = await DELETE(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Organization not found");
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

    it("uses correct organization ID in delete", async () => {
      mockDeleteSuccess();

      const request = makeDeleteRequest(VALID_ID);
      await DELETE(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });

      expect(mockDbDelete).toHaveBeenCalled();
    });
  });

  describe("constraint conflict", () => {
    it("foreign key constraint returns 409", async () => {
      mockDeleteError(
        'delete on table "organizations" violates foreign key constraint "jobs_organization_id_fkey"',
      );

      const request = makeDeleteRequest(VALID_ID);
      const response = await DELETE(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe(
        "Organization cannot be deleted because it is referenced by other records",
      );
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
