export const CSP_HEADER_NAME = "Content-Security-Policy";
export const CSP_REPORT_ONLY_HEADER_NAME = "Content-Security-Policy-Report-Only";

const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * 144 random bits (18 bytes) rendered as unpadded base64. Uses Web Crypto so it
 * works on both the Node.js and Edge middleware runtimes.
 */
export function generateCspNonce(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += BASE64_CHARS[b0 >> 2];
    out += BASE64_CHARS[((b0 & 3) << 4) | (b1 >> 4)];
    out += BASE64_CHARS[((b1 & 15) << 2) | (b2 >> 6)];
    out += BASE64_CHARS[b2 & 63];
  }
  return out;
}

export function buildCspHeader(nonce: string): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "form-action 'self'",
    "frame-src 'none'",
    "media-src 'none'",
  ].join("; ");
}