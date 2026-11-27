import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

vi.mock("@/lib/ssrf", () => ({
  ssrfFetch: (...args: unknown[]) => mocks.mockFetch(...args),
}));

import {
  fetchPageInfo,
  fetchPagePosts,
  createPageFeedPost,
  MAX_FEED_POST_MESSAGE_CHARS,
} from "../graphClient";
import { OWNED_FACEBOOK_PAGE_ID } from "../config";

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

describe("createPageFeedPost (POST /{page-id}/feed)", () => {
  it("posts a form-encoded body with a bearer header and no token in the URL", async () => {
    mocks.mockFetch.mockResolvedValue(
      okJson({ id: `${OWNED_FACEBOOK_PAGE_ID}_999`, post_id: "999" }),
    );

    const result = await createPageFeedPost(OWNED_FACEBOOK_PAGE_ID, "token-value", {
      message: "Senior Pilot — Addis Ababa",
      link: "https://jobethiopia.example/jobs/1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.postId).toBe("999");

    expect(mocks.mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mocks.mockFetch.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(url).toBe(
      `https://graph.facebook.com/v23.0/${OWNED_FACEBOOK_PAGE_ID}/feed`,
    );
    expect(url).not.toContain("access_token");
    expect(url).not.toContain("token-value");
    expect(options.method).toBe("POST");
    expect(options.headers).toEqual(
      expect.objectContaining({
        Authorization: "Bearer token-value",
        "content-type": "application/x-www-form-urlencoded",
      }),
    );
    expect(options.body).toBe(
      "message=Senior+Pilot+%E2%80%94+Addis+Ababa&link=https%3A%2F%2Fjobethiopia.example%2Fjobs%2F1",
    );
    expect(options.body).not.toContain("token-value");
  });

  it("parses the remote post id when only the compound id is returned", async () => {
    mocks.mockFetch.mockResolvedValue(
      okJson({ id: `${OWNED_FACEBOOK_PAGE_ID}_999` }),
    );

    const result = await createPageFeedPost(OWNED_FACEBOOK_PAGE_ID, "token-value", {
      message: "Vacancy",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.postId).toBe(`${OWNED_FACEBOOK_PAGE_ID}_999`);
  });

  it("rejects a page id that is not the owned JobEthiopia Page", async () => {
    const result = await createPageFeedPost("123456789", "token-value", {
      message: "Vacancy",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("owned");
    expect(result.ambiguous).toBe(false);
    expect(mocks.mockFetch).not.toHaveBeenCalled();
  });

  it("rejects an empty or oversized message without a request", async () => {
    const empty = await createPageFeedPost(OWNED_FACEBOOK_PAGE_ID, "token-value", {
      message: "   ",
    });
    expect(empty.ok).toBe(false);

    const oversized = await createPageFeedPost(
      OWNED_FACEBOOK_PAGE_ID,
      "token-value",
      { message: "x".repeat(MAX_FEED_POST_MESSAGE_CHARS + 1) },
    );
    expect(oversized.ok).toBe(false);
    expect(mocks.mockFetch).not.toHaveBeenCalled();
  });

  it("does not retry after a network failure and reports an ambiguous outcome", async () => {
    mocks.mockFetch.mockRejectedValue(new Error("Request timed out"));

    const result = await createPageFeedPost(OWNED_FACEBOOK_PAGE_ID, "token-value", {
      message: "Vacancy",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.ambiguous).toBe(true);
    expect(mocks.mockFetch).toHaveBeenCalledTimes(1);
  });

  it.each([500, 502, 503, 504])(
    "marks HTTP %i as ambiguous without retrying",
    async (status) => {
      mocks.mockFetch.mockResolvedValue(
        graphError(status, 2, "Temporary server error"),
      );

      const result = await createPageFeedPost(
        OWNED_FACEBOOK_PAGE_ID,
        "token-value",
        { message: "Vacancy" },
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.ambiguous).toBe(true);
      expect(result.error).toContain("Temporary server error");
      expect(mocks.mockFetch).toHaveBeenCalledTimes(1);
    },
  );

  it("marks HTTP 408 as ambiguous without retrying", async () => {
    mocks.mockFetch.mockResolvedValue({
      ok: false,
      status: 408,
      text: "",
    });

    const result = await createPageFeedPost(OWNED_FACEBOOK_PAGE_ID, "token-value", {
      message: "Vacancy",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.ambiguous).toBe(true);
    expect(result.error).toContain("408");
    expect(mocks.mockFetch).toHaveBeenCalledTimes(1);
  });

  it("treats a 429 rate-limit rejection as definite and does not retry", async () => {
    mocks.mockFetch.mockResolvedValue(
      graphError(429, 4, "Application request limit"),
    );

    const result = await createPageFeedPost(OWNED_FACEBOOK_PAGE_ID, "token-value", {
      message: "Vacancy",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.ambiguous).toBe(false);
    expect(mocks.mockFetch).toHaveBeenCalledTimes(1);
  });

  it("marks a 2xx response without a usable post id as ambiguous", async () => {
    mocks.mockFetch.mockResolvedValue(okJson({ success: true }));

    const result = await createPageFeedPost(OWNED_FACEBOOK_PAGE_ID, "token-value", {
      message: "Vacancy",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.ambiguous).toBe(true);
    expect(result.error).toContain("post id");
  });

  it("marks a 2xx response with an unreadable body as ambiguous", async () => {
    mocks.mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: "<html>gateway</html>",
    });

    const result = await createPageFeedPost(OWNED_FACEBOOK_PAGE_ID, "token-value", {
      message: "Vacancy",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.ambiguous).toBe(true);
  });

  it("reports a definite rejection with the Graph error detail", async () => {
    mocks.mockFetch.mockResolvedValue(
      graphError(403, 200, "Permissions error"),
    );

    const result = await createPageFeedPost(OWNED_FACEBOOK_PAGE_ID, "token-value", {
      message: "Vacancy",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.ambiguous).toBe(false);
    expect(result.error).toContain("Permissions error");
    if (result.code !== undefined) expect(result.code).toBe(200);
  });

  it("redacts credentials from publish errors", async () => {
    mocks.mockFetch.mockRejectedValue(
      new Error(
        "request failed for https://graph.facebook.com/x?access_token=secret-value Bearer secret-value",
      ),
    );

    const result = await createPageFeedPost(OWNED_FACEBOOK_PAGE_ID, "token-value", {
      message: "Vacancy",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).not.toContain("secret-value");
    expect(result.error).toContain("[REDACTED]");
  });

  it("always publishes over HTTPS to the trusted Graph origin", async () => {
    process.env.FACEBOOK_GRAPH_API_BASE_URL = "http://graph.facebook.com";
    mocks.mockFetch.mockResolvedValue(okJson({ id: "999" }));

    await createPageFeedPost(OWNED_FACEBOOK_PAGE_ID, "token-value", {
      message: "Vacancy",
    });

    const url = mocks.mockFetch.mock.calls[0][0] as string;
    expect(url.startsWith("https://graph.facebook.com/")).toBe(true);
    expect(url).not.toContain("http://");
  });
});
