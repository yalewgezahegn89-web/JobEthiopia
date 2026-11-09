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

  it("rejects a pagination URL outside the Graph origin", async () => {
    mocks.mockFetch.mockResolvedValueOnce(
      okJson({
        data: [{ id: "p1" }],
        paging: { next: "https://evil.example/posts?after=abc" },
      }),
    );

    const result = await fetchPagePosts("1", "token-value");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("origin mismatch");
    expect(mocks.mockFetch).toHaveBeenCalledTimes(1);
  });

  it("accepts same-origin HTTPS pagination", async () => {
    mocks.mockFetch
      .mockResolvedValueOnce(
        okJson({
          data: [{ id: "p1" }],
          paging: {
            next: "https://graph.facebook.com/v23.0/1/posts?after=abc",
          },
        }),
      )
      .mockResolvedValueOnce(okJson({ data: [{ id: "p2" }] }));

    const result = await fetchPagePosts("1", "token-value");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.posts.map((post) => post.id)).toEqual(["p1", "p2"]);
  });

  it.each([
    ["plaintext HTTP", "http://graph.facebook.com/v23.0/1/posts?after=abc"],
    [
      "an alternate port",
      "https://graph.facebook.com:8443/v23.0/1/posts?after=abc",
    ],
    [
      "credentials in the URL",
      "https://user:pass@graph.facebook.com/v23.0/1/posts?after=abc",
    ],
    [
      "a lookalike host",
      "https://graph.facebook.com.evil.example/v23.0/1/posts?after=abc",
    ],
  ])("rejects pagination with %s", async (_label, next) => {
    mocks.mockFetch.mockResolvedValueOnce(
      okJson({ data: [{ id: "p1" }], paging: { next } }),
    );

    const result = await fetchPagePosts("1", "token-value");

    expect(result.ok).toBe(false);
    expect(mocks.mockFetch).toHaveBeenCalledTimes(1);
  });

  it("always sends token-bearing requests over HTTPS to the Graph origin", async () => {
    process.env.FACEBOOK_GRAPH_API_BASE_URL = "http://graph.facebook.com";
    mocks.mockFetch.mockResolvedValue(okJson({ id: "1", name: "Page" }));

    await fetchPageInfo("1", "token-value");

    const url = mocks.mockFetch.mock.calls[0][0] as string;
    expect(url.startsWith("https://graph.facebook.com/")).toBe(true);
    expect(url).not.toContain("http://");
  });

  it("redacts credentials from surfaced errors", async () => {
    mocks.mockFetch.mockRejectedValue(
      new Error(
        "request failed for https://graph.facebook.com/x?access_token=secret-value Bearer secret-value",
      ),
    );

    const result = await fetchPageInfo("1", "token-value");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).not.toContain("secret-value");
    expect(result.error).toContain("[REDACTED]");
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
