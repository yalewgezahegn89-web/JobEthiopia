/**
 * Shared server-side CSRF / trusted-origin protection (Batch 51).
 *
 * Validates that a mutation originated from the configured application origin
 * by parsing and comparing actual URL origins (never substring matching), so
 * lookalike hosts such as `https://evil.example`,
 * `https://example.com.attacker.example`, or `https://example.com?a=b` are all
 * rejected.
 *
 * Policy:
 *   - If `Origin` is present it is authoritative and must match.
 *   - If `Origin` is absent, `Referer` is used as a fallback.
 *   - If neither is present (or the value is not a valid URL origin), the
 *     request is rejected. Server Actions / forms run within the app origin,
 *     so a missing origin on a state-changing request is treated as unsafe.
 *
 * The trusted origin is taken from APP_BASE_URL, falling back to
 * http://localhost:3000 for local development. Internal configuration is never
 * exposed in the returned error.
 */
import { headers } from "next/headers";

export class CsrfError extends Error {
  constructor() {
    super("Unexpected request origin");
    this.name = "CsrfError";
  }
}

export interface CsrfContext {
  origin?: string | null;
  referer?: string | null;
}

export function getAppBaseUrl(): string {
  const base = process.env.APP_BASE_URL?.trim();
  if (base && base.length > 0) return base;
  // In production an explicit APP_BASE_URL is required: silently falling back
  // to http://localhost:3000 would produce broken/insecure links (e.g.
  // password-reset emails) and a CSRF trusted origin that can never match.
  // Fail fast instead of emitting invalid production URLs.
  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_BASE_URL is required in production");
  }
  // Local development convenience only.
  return "http://localhost:3000";
}

export function parseOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    const hasHost = url.hostname.length > 0;
    const isHttp = url.protocol === "http:" || url.protocol === "https:";
    if (!hasHost || !isHttp) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Returns the canonical origin of the configured application URL, or null when unparsable. */
export function getTrustedOrigin(): string | null {
  return parseOrigin(getAppBaseUrl());
}

/**
 * Validates a request context. Returns true when the supplied Origin (or
 * Referer fallback) matches the trusted application origin. Throws CsrfError
 * when the request is untrusted or ambiguous.
 */
export function assertTrustedCsrf(context: CsrfContext): boolean {
  const trusted = getTrustedOrigin();
  if (!trusted) throw new CsrfError();

  const candidateValue = context.origin ?? context.referer ?? null;
  if (!candidateValue) {
    throw new CsrfError();
  }

  const candidateOrigin = parseOrigin(candidateValue);
  if (!candidateOrigin || candidateOrigin !== trusted) {
    throw new CsrfError();
  }

  return true;
}

/**
 * Convenience wrapper that reads the current request's Origin/Referer from the
 * Next.js headers() store. Intended for Server Actions where the underlying
 * Request object is not directly available.
 */
export async function assertTrustedCsrfFromRequest(): Promise<boolean> {
  const headerStore = await headers();
  const rawOrigin = headerStore.get("origin") as
    | string
    | null
    | { value?: string | null };
  const rawReferer = headerStore.get("referer") as
    | string
    | null
    | { value?: string | null };
  const origin =
    typeof rawOrigin === "string"
      ? rawOrigin
      : (rawOrigin?.value ?? null);
  const referer =
    typeof rawReferer === "string"
      ? rawReferer
      : (rawReferer?.value ?? null);
  return assertTrustedCsrf({ origin, referer });
}
