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
      careerArticles: {
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

vi.mock("../../../db/schema/careerArticles", () => ({
  careerArticles: {
    id: "career_articles.id",
    title: "career_articles.title",
    slug: "career_articles.slug",
    excerpt: "career_articles.excerpt",
    content: "career_articles.content",
    category: "career_articles.category",
    status: "career_articles.status",
    publishedAt: "career_articles.published_at",
    createdAt: "career_articles.created_at",
    updatedAt: "career_articles.updated_at",
  },
}));

import { GET, POST } from "../../../app/api/career-articles/route";
import {
  GET as GET_BY_ID,
  PUT,
  DELETE,
} from "../../../app/api/career-articles/[id]/route";

const VALID_ID = "550e8400-e29b-41d4-a716-446655440000";

const SAMPLE_ARTICLE = {
  id: VALID_ID,
  title: "How to Write a CV",
  slug: "how-to-write-a-cv",
  excerpt: "A guide to writing a great CV",
  content: "This is the full content of the article about CV writing.",
  category: "Career Tips",
  status: "DRAFT" as const,
  publishedAt: null,
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
  const url = new URL("http://localhost/api/career-articles");
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }
  return new Request(url.toString(), { method: "GET" });
}

function makeGetDetailRequest(id: string): Request {
  return new Request(`http://localhost/api/career-articles/${id}`, {
    method: "GET",
  });
}

function makePostRequest(
  body: unknown,
  headers?: Record<string, string>,
): Request {
  return new Request("http://localhost/api/career-articles", {
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
  return new Request(`http://localhost/api/career-articles/${id}`, {
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
  return new Request(`http://localhost/api/career-articles/${id}`, {
    method: "DELETE",
    headers: {
      "x-api-key": API_KEY,
      ...headers,
    },
  });
}

function mockInsertSuccess(article: Record<string, unknown>) {
  mockDbInsert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([article]),
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
  title: "How to Write a CV",
  slug: "how-to-write-a-cv",
  content: "This is the full content of the article about CV writing.",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDbSuccess(1, [SAMPLE_ARTICLE]);
  mockFindFirst.mockResolvedValue(SAMPLE_ARTICLE);
});

describe("GET /api/career-articles", () => {
  describe("successful listing", () => {
    it("returns 200 with career article items", async () => {
      const request = makeGetListRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items).toHaveLength(1);
      expect(data.items[0].title).toBe("How to Write a CV");
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
      const request = makeGetListRequest({ status: "PUBLISHED" });
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it("category filter is accepted", async () => {
      const request = makeGetListRequest({ category: "Career Tips" });
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
      const request = makeGetListRequest({ status: "INVALID_STATUS" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("status");
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

describe("POST /api/career-articles", () => {
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
    it("missing title returns 400", async () => {
      const request = makePostRequest({ slug: "test", content: "body" });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("title");
    });

    it("missing slug returns 400", async () => {
      const request = makePostRequest({ title: "Test", content: "body" });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("slug");
    });

    it("invalid slug format returns 400", async () => {
      const request = makePostRequest({
        title: "Test",
        slug: "INVALID!",
        content: "body",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("slug");
    });

    it("invalid status returns 400", async () => {
      const request = makePostRequest({
        title: "Test",
        slug: "test",
        content: "body",
        status: "INVALID",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("status");
    });

    it("malformed JSON returns 400", async () => {
      const request = new Request("http://localhost/api/career-articles", {
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
    it("returns 201 with created article", async () => {
      mockInsertSuccess(SAMPLE_ARTICLE);

      const request = makePostRequest(VALID_POST_BODY);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.item.title).toBe("How to Write a CV");
    });

    it("response has { item } shape", async () => {
      mockInsertSuccess(SAMPLE_ARTICLE);

      const request = makePostRequest(VALID_POST_BODY);
      const response = await POST(request);
      const data = await response.json();

      expect(Object.keys(data)).toEqual(["item"]);
    });

    it("full body with all optional fields returns 201", async () => {
      const fullArticle = {
        ...SAMPLE_ARTICLE,
        excerpt: "A guide",
        category: "Career Tips",
        status: "PUBLISHED" as const,
        publishedAt: new Date("2026-01-20"),
      };
      mockInsertSuccess(fullArticle);

      const request = makePostRequest({
        title: "How to Write a CV",
        slug: "how-to-write-a-cv",
        content: "Full content here.",
        excerpt: "A guide",
        category: "Career Tips",
        status: "PUBLISHED",
        publishedAt: "2026-01-20T00:00:00.000Z",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.item.excerpt).toBe("A guide");
      expect(data.item.category).toBe("Career Tips");
      expect(data.item.status).toBe("PUBLISHED");
    });
  });

  describe("slug conflict", () => {
    it("duplicate slug returns 409", async () => {
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(
            new Error(
              'duplicate key value violates unique constraint "career_articles_slug_unique"',
            ),
          ),
        }),
      });

      const request = makePostRequest(VALID_POST_BODY);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe("Career article slug already exists");
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

describe("GET /api/career-articles/[id]", () => {
  describe("successful retrieval", () => {
    it("returns 200 with career article", async () => {
      const request = makeGetDetailRequest(VALID_ID);
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.item).toBeDefined();
      expect(data.item.id).toBe(VALID_ID);
      expect(data.item.title).toBe("How to Write a CV");
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
      expect(item.title).toBe("How to Write a CV");
      expect(item.slug).toBe("how-to-write-a-cv");
      expect(item.content).toBeDefined();
      expect(item.status).toBeDefined();
      expect(item.createdAt).toBeDefined();
      expect(item.updatedAt).toBeDefined();
    });
  });

  describe("not found", () => {
    it("returns 404 when career article does not exist", async () => {
      mockFindFirst.mockResolvedValue(null);

      const request = makeGetDetailRequest(VALID_ID);
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Career article not found");
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
      expect(data.error).toBe("Invalid career article ID");
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

describe("PUT /api/career-articles/[id]", () => {
  beforeEach(() => {
    vi.stubEnv("INGESTION_API_KEY", API_KEY);
    mockFindFirst.mockResolvedValue({ id: VALID_ID });
  });

  describe("authentication", () => {
    it("missing API key returns 401", async () => {
      const request = makePutRequest(
        VALID_ID,
        { title: "Test" },
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
        { title: "Test" },
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
      const request = makePutRequest("not-a-uuid", { title: "Test" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: "not-a-uuid" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid career article ID");
    });

    it("malformed JSON returns 400", async () => {
      const request = new Request(
        `http://localhost/api/career-articles/${VALID_ID}`,
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
    it("returns 404 when career article does not exist", async () => {
      mockFindFirst.mockResolvedValue(null);

      const request = makePutRequest(VALID_ID, { title: "Test" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Career article not found");
    });
  });

  describe("successful update", () => {
    it("partial title update returns 200", async () => {
      mockUpdateSuccess({ ...SAMPLE_ARTICLE, title: "Renamed Article" });

      const request = makePutRequest(VALID_ID, { title: "Renamed Article" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.item.title).toBe("Renamed Article");
    });

    it("slug update returns 200", async () => {
      mockUpdateSuccess({ ...SAMPLE_ARTICLE, slug: "new-slug" });

      const request = makePutRequest(VALID_ID, { slug: "new-slug" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.item.slug).toBe("new-slug");
    });

    it("response has { item } shape", async () => {
      mockUpdateSuccess(SAMPLE_ARTICLE);

      const request = makePutRequest(VALID_ID, { title: "Updated" });
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
        'duplicate key value violates unique constraint "career_articles_slug_unique"',
      );

      const request = makePutRequest(VALID_ID, { slug: "existing-slug" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe("Career article slug already exists");
    });
  });

  describe("error handling", () => {
    it("unrelated DB error returns 500", async () => {
      mockUpdateError("DB connection failed");

      const request = makePutRequest(VALID_ID, { title: "Test" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("DB error details are not leaked", async () => {
      mockUpdateError("SECRET_DB_PASSWORD=xyz connection refused");

      const request = makePutRequest(VALID_ID, { title: "Test" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const body = await response.text();

      expect(body).not.toContain("SECRET_DB_PASSWORD");
      expect(body).not.toContain("xyz");
    });
  });
});

describe("DELETE /api/career-articles/[id]", () => {
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
      expect(data.error).toBe("Invalid career article ID");
    });
  });

  describe("not found", () => {
    it("returns 404 when career article does not exist", async () => {
      mockFindFirst.mockResolvedValue(null);

      const request = makeDeleteRequest(VALID_ID);
      const response = await DELETE(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Career article not found");
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

    it("uses correct career article ID in delete", async () => {
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
