import dns from "node:dns";
import net from "node:net";
import http from "node:http";
import https from "node:https";

const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 10_000;
const ALLOWED_SCHEMES = new Set(["http:", "https:"]);

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const n = ip.toLowerCase();
  if (n === "::1" || n === "::") return true;
  if (n.startsWith("fc") || n.startsWith("fd")) return true;
  if (n.startsWith("fe80")) return true;
  return false;
}

export function isPrivateIP(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  return true;
}

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfError";
  }
}

function validateScheme(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SsrfError(`Invalid URL: ${rawUrl}`);
  }
  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    throw new SsrfError(
      `Blocked URL scheme "${parsed.protocol}" — only http and https are allowed`,
    );
  }
  if (!parsed.hostname) {
    throw new SsrfError("URL has no hostname");
  }
  return parsed;
}

function resolveIp(hostname: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    dns.resolve4(hostname, (err4, addresses4) => {
      const ipv4s = err4 ? [] : addresses4;
      dns.resolve6(hostname, (err6, addresses6) => {
        const ipv6s = err6 ? [] : addresses6;
        const all = [...ipv4s, ...ipv6s];
        if (all.length === 0) {
          const dnsErr = err4 || err6;
          reject(
            new SsrfError(
              `DNS resolution failed for "${hostname}": ${dnsErr?.message || "no addresses"}`,
            ),
          );
          return;
        }
        resolve(all);
      });
    });
  });
}

async function resolveAndValidateIp(hostname: string): Promise<void> {
  const addresses = await resolveIp(hostname);
  for (const addr of addresses) {
    if (isPrivateIP(addr)) {
      throw new SsrfError(
        `Resolved hostname "${hostname}" to private/reserved IP ${addr}`,
      );
    }
  }
}

function fetchOnce(
  url: URL,
  method: string,
  signal: AbortSignal,
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const mod = url.protocol === "https:" ? https : http;
    const opts: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname + url.search,
      method,
      signal,
      timeout: TIMEOUT_MS,
    };
    const req = mod.request(opts, (res) => {
      res.resume();
      resolve({ statusCode: res.statusCode ?? 0, headers: res.headers });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new SsrfError("Request timed out"));
    });
    req.end();
  });
}

function resolveLocation(location: string, base: URL): URL {
  try {
    return new URL(location);
  } catch {
    return new URL(location, base);
  }
}

export async function ssrfFetch(
  rawUrl: string,
  options: { method?: string } = {},
): Promise<{ ok: boolean; status: number }> {
  const parsed = validateScheme(rawUrl);
  const method = (options.method ?? "GET").toUpperCase();

  await resolveAndValidateIp(parsed.hostname);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    let currentUrl = parsed;
    let hops = 0;

    while (hops <= MAX_REDIRECTS) {
      const result = await fetchOnce(currentUrl, method, controller.signal);

      if (
        result.statusCode >= 300 &&
        result.statusCode < 400 &&
        result.headers.location
      ) {
        hops += 1;
        if (hops > MAX_REDIRECTS) {
          throw new SsrfError(
            `Too many redirects (max ${MAX_REDIRECTS})`,
          );
        }

        const redirectUrl = resolveLocation(result.headers.location, currentUrl);
        validateScheme(redirectUrl.toString());
        await resolveAndValidateIp(redirectUrl.host);
        currentUrl = redirectUrl;
        continue;
      }

      return {
        ok: result.statusCode >= 200 && result.statusCode < 400,
        status: result.statusCode,
      };
    }

    throw new SsrfError(
      `Too many redirects (max ${MAX_REDIRECTS})`,
    );
  } catch (err) {
    if (err instanceof SsrfError) throw err;
    if (
      err instanceof Error &&
      (err.name === "AbortError" || err.message.includes("abort"))
    ) {
      throw new SsrfError("Request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
