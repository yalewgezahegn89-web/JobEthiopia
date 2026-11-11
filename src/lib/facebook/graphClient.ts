/**
 * Meta Graph API client for the JobEthiopia Facebook Page.
 *
 * Reads are limited to published Page posts and only these fields are
 * requested: `id`, `message`, `created_time`, `permalink_url`. The single
 * write operation is `createPageFeedPost` (POST /{page-id}/feed), which is
 * restricted to the owned Page, issued exactly once without retries, and
 * reports ambiguous network outcomes distinctly. The access token is sent
 * via the `Authorization: Bearer` header (never as a query parameter or in
 * the form body) and is redacted from every error surfaced to callers.
 */
import { ssrfFetch } from "@/lib/ssrf";
import {
  getFacebookGraphConfig,
  OWNED_FACEBOOK_PAGE_ID,
  redactFacebookSecrets,
} from "./config";

export interface FacebookPostDto {
  id: string;
  message?: string;
  created_time?: string;
  permalink_url?: string;
}

export interface FacebookPageInfo {
  id: string;
  name: string;
}

export type GraphResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; retryable: boolean; code?: number };

const POST_FIELDS = "id,message,created_time,permalink_url";
const DEFAULT_LIMIT = 25;
const MAX_PAGES = 10;
const MAX_ATTEMPTS = 3;
const RETRYABLE_GRAPH_CODES = new Set([4, 17, 32, 613]);
const NON_RETRYABLE_GRAPH_CODES = new Set([10, 100, 190, 200]);

interface GraphErrorPayload {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
}

function parseGraphError(
  body: string | undefined,
): { code?: number; message?: string } {
  if (!body) return {};
  try {
    const parsed = JSON.parse(body) as GraphErrorPayload;
    return {
      code: parsed.error?.code,
      message: parsed.error?.message,
    };
  } catch {
    return {};
  }
}

function isRetryable(
  status: number,
  code: number | undefined,
): boolean {
  if (code !== undefined) {
    if (NON_RETRYABLE_GRAPH_CODES.has(code)) return false;
    if (RETRYABLE_GRAPH_CODES.has(code)) return true;
  }
  return status === 429 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildGraphUrl(path: string): string {
  const config = getFacebookGraphConfig();
  const normalized = path.replace(/^\/+/, "");
  return `${config.apiBaseUrl}/${config.apiVersion}/${normalized}`;
}

/**
 * True only for HTTPS URLs on the exact configured Graph origin. This guards
 * every request that carries the bearer token, independent of how the URL was
 * built.
 */
function isAllowedGraphUrl(raw: string): boolean {
  const config = getFacebookGraphConfig();
  let url: URL;
  let base: URL;
  try {
    url = new URL(raw);
    base = new URL(config.apiBaseUrl);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  return url.origin === base.origin;
}

/**
 * Validates a `paging.next` URL. It must stay on the configured Graph host
 * and point at our Graph API version. Any `access_token` query parameter is
 * removed because authentication is header-based.
 */
function sanitizeNextUrl(
  next: string,
): { ok: true; url: string } | { ok: false; reason: string } {
  const config = getFacebookGraphConfig();
  let nextUrl: URL;
  let baseUrl: URL;
  try {
    nextUrl = new URL(next);
    baseUrl = new URL(config.apiBaseUrl);
  } catch {
    return { ok: false, reason: "Invalid pagination URL" };
  }

  if (nextUrl.protocol !== "https:") {
    return { ok: false, reason: "Pagination URL must use HTTPS" };
  }
  if (nextUrl.username || nextUrl.password) {
    return {
      ok: false,
      reason: "Pagination URL must not contain credentials",
    };
  }
  if (nextUrl.origin !== baseUrl.origin) {
    return { ok: false, reason: "Pagination URL origin mismatch" };
  }
  if (!nextUrl.pathname.includes(`/${config.apiVersion}/`)) {
    return { ok: false, reason: "Pagination URL version mismatch" };
  }

  nextUrl.searchParams.delete("access_token");
  return { ok: true, url: nextUrl.toString() };
}

async function graphGet<T>(
  url: string,
  accessToken: string,
): Promise<GraphResult<T>> {
  if (!isAllowedGraphUrl(url)) {
    return {
      ok: false,
      error: "Graph API request blocked: untrusted origin",
      retryable: false,
    };
  }

  let lastError = "Graph API request failed";
  let lastRetryable = false;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(250 * 2 ** (attempt - 1));
    }

    let response: Awaited<ReturnType<typeof ssrfFetch>>;
    try {
      response = await ssrfFetch(url, {
        method: "GET",
        maxBytes: 1_000_000,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });
    } catch (err) {
      lastError = redactFacebookSecrets(
        err instanceof Error ? err.message : "Graph API request failed",
      );
      lastRetryable = true;
      continue;
    }

    if (response.ok) {
      try {
        return { ok: true, data: JSON.parse(response.text ?? "") as T };
      } catch {
        return {
          ok: false,
          error: "Graph API returned invalid JSON",
          retryable: false,
        };
      }
    }

    const parsed = parseGraphError(response.text);
    const code = parsed.code;
    lastRetryable = isRetryable(response.status, code);
    lastError = redactFacebookSecrets(
      parsed.message ??
        `Graph API responded with HTTP ${response.status}`,
    );

    if (!lastRetryable) {
      return { ok: false, error: lastError, retryable: false, code };
    }
  }

  return { ok: false, error: lastError, retryable: lastRetryable };
}

export async function fetchPageInfo(
  pageId: string,
  accessToken: string,
): Promise<GraphResult<FacebookPageInfo>> {
  const url = buildGraphUrl(`${encodeURIComponent(pageId)}?fields=id,name`);
  const result = await graphGet<FacebookPageInfo>(url, accessToken);
  if (!result.ok) return result;
  if (!result.data?.id || !result.data?.name) {
    return {
      ok: false,
      error: "Graph API did not return a page id and name",
      retryable: false,
    };
  }
  return result;
}

export interface PagePostsResult {
  posts: FacebookPostDto[];
  /** True when pagination stopped because MAX_PAGES was reached. */
  truncated: boolean;
}

export async function fetchPagePosts(
  pageId: string,
  accessToken: string,
  options: { limit?: number; since?: string } = {},
): Promise<GraphResult<PagePostsResult>> {
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIMIT, 1), 100);
  const params = new URLSearchParams({
    fields: POST_FIELDS,
    limit: String(limit),
  });
  if (options.since) params.set("since", options.since);

  const firstUrl = buildGraphUrl(
    `${encodeURIComponent(pageId)}/posts?${params.toString()}`,
  );

  const posts: FacebookPostDto[] = [];
  let nextUrl: string | null = firstUrl;
  let pageCount = 0;

  while (nextUrl && pageCount < MAX_PAGES) {
    const result = await graphGet<{
      data?: FacebookPostDto[];
      paging?: { next?: string };
    }>(nextUrl, accessToken);

    if (!result.ok) return result;

    for (const post of result.data.data ?? []) {
      if (post?.id) posts.push(post);
    }

    pageCount += 1;

    const next = result.data.paging?.next;
    if (!next) {
      nextUrl = null;
      continue;
    }

    const sanitized = sanitizeNextUrl(next);
    if (!sanitized.ok) {
      return {
        ok: false,
        error: sanitized.reason,
        retryable: false,
      };
    }
    nextUrl = sanitized.url;
  }

  return {
    ok: true,
    data: { posts, truncated: Boolean(nextUrl) },
  };
}

/* -------------------------------------------------------------------------- */
/*  Page feed publishing (POST /{page-id}/feed)                                */
/* -------------------------------------------------------------------------- */

export interface PageFeedPostInput {
  message: string;
  link?: string;
}

/**
 * Result of a Page feed publish attempt.
 *
 * `ambiguous: true` means the request failed without a definitive answer. The
 * post may or may not exist on Facebook. This covers network failures and
 * timeouts, HTTP 408 (request timeout), every HTTP 5xx (the server may have
 * processed the write before failing), and a 2xx response whose body could not
 * be read or did not contain a post id. Callers must record such outcomes as
 * UNKNOWN and must never retry automatically, because a retry could create a
 * duplicate post.
 *
 * `ambiguous: false` means Facebook definitively rejected the request, so no
 * post was created and the attempt is safe to re-claim manually. This covers
 * client-side validation before the request, Graph API 4xx error responses
 * (including 429 rate-limit rejections, which are refused before the write is
 * processed), and an untrusted destination/origin.
 */
export type PageFeedPostResult =
  | { ok: true; postId: string }
  | {
      ok: false;
      error: string;
      code?: number;
      ambiguous: boolean;
    };

/** Hard cap on the posted message (well below Meta's own post-size limit). */
export const MAX_FEED_POST_MESSAGE_CHARS = 5000;

interface FeedPostResponse {
  id?: unknown;
  post_id?: unknown;
}

/**
 * Creates one post on the JobEthiopia-owned Page feed via
 * `POST /{page-id}/feed`.
 *
 * Safety properties:
 * - Only the owned JobEthiopia Page ID is accepted; any other destination is
 *   refused before a request is made.
 * - The token is sent only in the `Authorization: Bearer` header, never in
 *   the URL or the form body.
 * - The body is form-encoded and contains only `message` and an optional
 *   `link`.
 * - The request is issued exactly once. There is no retry logic of any kind:
 *   a repeat POST could create a duplicate published post. Network failures,
 *   HTTP 408/5xx responses, and unreadable successes are reported as
 *   ambiguous; only a definite Graph rejection is reported as non-ambiguous.
 * - Errors are redacted before they are surfaced.
 *
 * The existing read-only GET behavior above is untouched.
 */
export async function createPageFeedPost(
  pageId: string,
  accessToken: string,
  input: PageFeedPostInput,
): Promise<PageFeedPostResult> {
  if (pageId !== OWNED_FACEBOOK_PAGE_ID) {
    return {
      ok: false,
      error: "Refusing to publish: the destination is not the owned JobEthiopia Facebook Page",
      ambiguous: false,
    };
  }

  const message = input.message.trim();
  if (!message) {
    return {
      ok: false,
      error: "Post message is empty",
      ambiguous: false,
    };
  }
  if (message.length > MAX_FEED_POST_MESSAGE_CHARS) {
    return {
      ok: false,
      error: "Post message exceeds the maximum allowed length",
      ambiguous: false,
    };
  }

  const form = new URLSearchParams();
  form.set("message", message);
  const link = input.link?.trim();
  if (link) form.set("link", link);

  const url = buildGraphUrl(`${encodeURIComponent(pageId)}/feed`);
  if (!isAllowedGraphUrl(url)) {
    return {
      ok: false,
      error: "Graph API publish blocked: untrusted origin",
      ambiguous: false,
    };
  }

  let response: Awaited<ReturnType<typeof ssrfFetch>>;
  try {
    response = await ssrfFetch(url, {
      method: "POST",
      maxBytes: 100_000,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "content-type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: form.toString(),
    });
  } catch (err) {
    // Network-level failure (timeout, DNS, connection reset): no definitive
    // response was received, so the post may or may not have been created.
    // Ambiguous — the caller must record UNKNOWN and never auto-retry.
    return {
      ok: false,
      error: redactFacebookSecrets(
        err instanceof Error ? err.message : "Graph API publish request failed",
      ),
      ambiguous: true,
    };
  }

  if (response.ok) {
    let parsed: FeedPostResponse | null = null;
    try {
      parsed = JSON.parse(response.text ?? "") as FeedPostResponse;
    } catch {
      parsed = null;
    }

    const postId =
      typeof parsed?.post_id === "string" && parsed.post_id.length > 0
        ? parsed.post_id
        : typeof parsed?.id === "string" && parsed.id.length > 0
          ? parsed.id
          : null;

    if (!postId) {
      // Facebook signalled success but the response did not contain a usable
      // post id. The post may exist, so this is ambiguous.
      return {
        ok: false,
        error: "Graph API publish response did not contain a post id",
        ambiguous: true,
      };
    }

    return { ok: true, postId };
  }

  // HTTP 408 (request timeout) and every HTTP 5xx are ambiguous: the server
  // may have accepted the write before timing out or failing, so a post could
  // exist. They are never retried automatically.
  const ambiguous = response.status === 408 || response.status >= 500;

  const parsed = parseGraphError(response.text);
  const error = redactFacebookSecrets(
    parsed.message ?? `Graph API rejected the post (HTTP ${response.status})`,
  );

  if (ambiguous) {
    return {
      ok: false,
      error,
      code: parsed.code,
      ambiguous: true,
    };
  }

  // Any other explicit error response (e.g. a 4xx Graph rejection, including
  // 429 rate limiting) means Facebook definitively rejected the post; no post
  // was created.
  return {
    ok: false,
    error,
    code: parsed.code,
    ambiguous: false,
  };
}
