import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

vi.mock("@/lib/ssrf", () => ({
  ssrfFetch: (...args: unknown[]) => mocks.mockFetch(...args),
}));

import { fetchPageInfo, fetchPagePosts } from "../graphClient";

const ORIGINAL_ENV = { ...process.env };

function okJson(body: unknown, text?: string) {
  return {
    ok: true,
    status: 200,
    text: text ?? JSON.stringify(body),
  };
}

function graphError(status: number, code: number, message: string) {
  return {
    ok: false,
    status,
    text: JSON.stringify({ error: { code, message } }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.FACEBOOK_GRAPH_API_VERSION = "v23.0";
  process.env.FACEBOOK_GRAPH_API_BASE_URL = "https://graph.facebook.com";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("Graph API client", () => {
  it("requests only the documented fields with a bearer header", async () => {
    mocks.mockFetch.mockResolvedValue(
      okJson({ id: "1", name: "Example Page" }),
    );

    const result = await fetchPageInfo("1", "token-value");

    expect(result.ok).toBe(true);
    expect(mocks.mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "/v23.0/1?fields=id,name",
      ),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer token-value",
        }),
      }),
    );
    const url = mocks.mockFetch.mock.calls[0][0] as string;
    expect(url).not.toContain("access_token");
  });

  it("follows pagination and strips access_token from next URLs", async () => {
    mocks.mockFetch
      .mockResolvedValueOnce(
        okJson({
          data: [{ id: "p1", message: "Vacancy" }],
          paging: {
            next: "https://graph.facebook.com/v23.0/1/posts?access_token=secret&after=abc",
          },
        }),
      )
      .mockResolvedValueOnce(
        okJson({ data: [{ id: "p2", message: "Vacancy 2" }] }),
      );

    const result = await fetchPagePosts("1", "token-value", { limit: 10 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.posts.map((post) => post.id)).toEqual(["p1", "p2"]);

    const secondUrl = mocks.mockFetch.mock.calls[1][0] as string;
    expect(secondUrl).toContain("after=abc");
    expect(secondUrl).not.toContain("access_token");
  });

  it("rejects a pagination URL outside the Graph host", async () => {
    mocks.mockFetch.mockResolvedValueOnce(
      okJson({
        data: [{ id: "p1" }],
        paging: { next: "https://evil.example/posts?after=abc" },
      }),
    );

    const result = await fetchPagePosts("1", "token-value");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("host mismatch");
    expect(mocks.mockFetch).toHaveBeenCalledTimes(1);
  });

  it("does not retry non-retryable permission errors", async () => {
    mocks.mockFetch.mockResolvedValue(
      graphError(400, 190, "Invalid OAuth access token"),
    );

    const result = await fetchPageInfo("1", "token-value");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(190);
    expect(result.retryable).toBe(false);
    expect(mocks.mockFetch).toHaveBeenCalledTimes(1);
  });

  it("retries rate-limit errors before succeeding", async () => {
    mocks.mockFetch
      .mockResolvedValueOnce(graphError(429, 4, "Application request limit"))
      .mockResolvedValueOnce(okJson({ id: "1", name: "Example Page" }));

    const result = await fetchPageInfo("1", "token-value");

    expect(result.ok).toBe(true);
    expect(mocks.mockFetch).toHaveBeenCalledTimes(2);
  });

  it("returns a sanitized error when the response is not JSON", async () => {
    mocks.mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: "<html>oops</html>",
    });

    const result = await fetchPageInfo("1", "token-value");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("invalid JSON");
  });
});
