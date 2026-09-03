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
 * Trusted origins:
 *   - Always: the canonical origin derived from APP_BASE_URL (falling back to
 *     http://localhost:3000 for local development).
 *   - Vercel Preview only (VERCEL_ENV === "preview"): the exact current
 *     deployment origin, built from https://${VERCEL_URL}. This is matched as
 *     an exact origin, so arbitrary or unrelated *.vercel.app hosts, subdomains
 *     of the canonical host, and strings that merely contain a trusted hostname
 *     remain rejected. Production deployments intentionally trust only the
 *     canonical APP_BASE_URL origin.
 *
 * Internal configuration is never exposed in the returned error.
 */
import { headers } from "next/headers";
import { getAppBaseUrl } from "@/lib/appBaseUrl";

export { getAppBaseUrl };

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
 * Returns the complete set of origins trusted for CSRF validation.
 *
 * The canonical APP_BASE_URL origin is always trusted. In Vercel Preview only,
 * the exact current deployment origin (https://${VERCEL_URL}) is added so the
 * polished Preview login can authenticate. The deployment origin is derived and
 * then parsed, so it is trusted only when it yields a valid http(s) origin and
 * is matched by exact string equality.
 */
export function getTrustedOrigins(): Set<string> {
  const trusted = new Set<string>();

  const canonical = getTrustedOrigin();
  if (canonical) trusted.add(canonical);

  if (process.env.VERCEL_ENV === "preview") {
    const deploymentHost = process.env.VERCEL_URL;
    if (deploymentHost && !deploymentHost.includes("://")) {
      const deploymentOrigin = parseOrigin(`https://${deploymentHost}`);
      if (deploymentOrigin) trusted.add(deploymentOrigin);
    }
  }

  return trusted;
}

/**
 * Validates a request context. Returns true when the supplied Origin (or
 * Referer fallback) matches one of the trusted application origins. Throws
 * CsrfError when the request is untrusted or ambiguous.
 */
export function assertTrustedCsrf(context: CsrfContext): boolean {
  const trustedOrigins = getTrustedOrigins();
  if (trustedOrigins.size === 0) throw new CsrfError();

  const candidateValue = context.origin ?? context.referer ?? null;
  if (!candidateValue) {
    throw new CsrfError();
  }

  const candidateOrigin = parseOrigin(candidateValue);
  if (!candidateOrigin || !trustedOrigins.has(candidateOrigin)) {
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
