/**
 * Minimal, read-only Meta Graph API client for Facebook Page posts.
 *
 * Only published Page posts are read, and only these fields are requested:
 * `id`, `message`, `created_time`, `permalink_url`. The access token is sent
 * via the `Authorization: Bearer` header (never as a query parameter) and is
 * redacted from every error surfaced to callers.
 */
import { ssrfFetch } from "@/lib/ssrf";
import {
  getFacebookGraphConfig,
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

  if (nextUrl.hostname.toLowerCase() !== baseUrl.hostname.toLowerCase()) {
    return { ok: false, reason: "Pagination URL host mismatch" };
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
