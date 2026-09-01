/**
 * Request correlation IDs (Batch 76).
 *
 * Request IDs are server-generated per request (crypto.randomUUID) and
 * propagated downstream via the `x-request-id` request header (set by
 * middleware) so route handlers and server actions can correlate log lines.
 *
 * The inbound `x-request-id` header is NEVER trusted as canonical; a fresh
 * UUID is always generated server-side.
 *
 * Implementation note: UUID generation uses the Web Crypto API's global
 * `crypto.randomUUID()`, which is available in both the Node.js runtime and
 * the Next.js Edge Runtime (middleware). A Node-only `node:crypto` import is
 * intentionally avoided so middleware can load without the native crypto
 * module.
 */

export const REQUEST_ID_HEADER = "x-request-id";

/** Generates a fresh, server-side request ID. */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

/** Legacy name kept for clarity of intent at generation sites. */
export const newRequestId = generateRequestId;

/**
 * Reads the active request's correlation ID from the current request context.
 *
 * Returns `undefined` when called outside a request context (for example, a
 * background job) or when no header is present. Never throws.
 */
export async function getRequestId(): Promise<string | undefined> {
  try {
    const { headers } = await import("next/headers");
    const requestHeaders = await headers();
    return requestHeaders.get(REQUEST_ID_HEADER) ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Applies the request ID to a given Headers-like object, guarding against
 * read-only or plain-object responses so middleware behavior is preserved.
 */
export function applyRequestIdToHeaders(
  headersLike: { set?: (name: string, value: string) => void } | undefined,
  requestId: string,
): void {
  if (headersLike && typeof headersLike.set === "function") {
    try {
      headersLike.set(REQUEST_ID_HEADER, requestId);
    } catch {
      // Never let instrumentation break the response.
    }
  }
}
