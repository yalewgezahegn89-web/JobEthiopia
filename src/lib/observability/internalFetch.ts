/**
 * Internal (server-to-server) HTTP instrumentation (Phase 16 Batch 2).
 *
 * The public data modules fan out to their own route handlers over HTTP when
 * no base URL override is supplied. That fan-out is invisible to the route
 * metrics (the call is not itself a user request), so it is measured here.
 *
 * Contracts:
 *  - Purely observational: the underlying fetcher is called with exactly the
 *    same `input` and `init` the caller supplied; responses, throws and
 *    ordering are unchanged. No timeout, retry or cache policy is added.
 *  - Privacy: only the target PATHNAME is recorded. Query strings (search
 *    terms, filters, tokens in the URL) and any response body are discarded.
 *  - Never throws on its own: measurement failures are swallowed by the
 *    metrics layer.
 */
import { getRequestId } from "./requestId";
import { recordInternalFetch } from "./metrics";

/** Structural type shared by every `public.ts` fetcher. */
export type InternalFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

/** Bounds on recorded target strings (privacy/defence in depth). */
const MAX_TARGET_LENGTH = 200;

/**
 * Derives a bounded pathname from an absolute or relative fetch input.
 * Query strings, fragments and credentials are never returned.
 */
export function internalTargetOf(input: RequestInfo | URL): string {
  try {
    let raw: string;
    if (typeof input === "string") raw = input;
    else if (input instanceof URL) raw = input.href;
    else raw = String((input as { url?: string }).url ?? "");

    const withoutQuery = raw.split("?")[0].split("#")[0];
    let pathname = withoutQuery;
    try {
      pathname = new URL(withoutQuery, "http://internal.invalid").pathname;
    } catch {
      // Relative-looking values that are not parseable stay as-is.
    }
    if (pathname.length > MAX_TARGET_LENGTH) {
      pathname = pathname.slice(0, MAX_TARGET_LENGTH);
    }
    return pathname || "/";
  } catch {
    return "/";
  }
}

async function safeRequestId(): Promise<string | undefined> {
  try {
    return await getRequestId();
  } catch {
    return undefined;
  }
}

/**
 * Executes `fetcher` and records duration, success and per-request fan-out
 * attribution. The measurement starts after the correlation id is resolved so
 * header-reading overhead is not attributed to the downstream call.
 */
export async function timedFetch(
  fetcher: InternalFetcher,
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const target = internalTargetOf(input);
  const requestId = await safeRequestId();
  const start = performance.now();
  let ok = false;
  try {
    const response = await fetcher(input, init);
    ok = response.ok;
    return response;
  } finally {
    recordInternalFetch({
      target,
      durationMs: Math.round(performance.now() - start),
      ok,
      requestId,
    });
  }
}
