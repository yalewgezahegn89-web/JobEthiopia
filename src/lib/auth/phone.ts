/**
 * Ethiopian mobile phone normalization (Stage 1 of phone/OTP authentication).
 *
 * Normalizes Ethiopian mobile numbers to one canonical E.164 form:
 *   - Ethio telecom:     +2519xxxxxxxx
 *   - Safaricom Ethiopia:+2517xxxxxxxx
 *
 * Accepted input formats:
 *   - Local:  09xxxxxxxx and 07xxxxxxxx (10 digits, trunk prefix 0)
 *   - Intl:   +2519xxxxxxxx and +2517xxxxxxxx
 *
 * The function strips surrounding whitespace, internal spaces, hyphens and
 * parentheses, then re-validates the digits so only valid Ethiopian mobile
 * numbers are accepted. Arbitrary international numbers are rejected.
 *
 * This is a server-side utility; clients must never be the source of truth for
 * normalization.
 */

export const ETHIOPIA_COUNTRY_CODE = "251";
export const E164_PREFIX = `+${ETHIOPIA_COUNTRY_CODE}`;

/** Length of the national significant number (leading digit + 8 digits). */
const NSN_LENGTH = 9;

/** Leading NSN digits that identify an Ethiopian mobile prefix. */
export const ETHIO_TELECOM_MOBILE_LEAD = "9";
export const SAFARICOM_ETHIOPIA_MOBILE_LEAD = "7";

/** A normalized E.164 Ethiopian mobile number, e.g. "+251912345678". */
export type EthiopianPhone = string & { readonly __brand: "EthiopianPhone" };

function brand(phone: string): EthiopianPhone {
  return phone as EthiopianPhone;
}

function stripFormatting(input: string): string {
  return input.trim().replace(/[\s\-()]/g, "");
}

/**
 * True when `nsn` is a valid 9-digit Ethiopian mobile national significant
 * number (starts with 7 for Safaricom Ethiopia or 9 for Ethio telecom).
 */
export function isValidEthiopianMobileNsn(nsn: string): boolean {
  if (nsn.length !== NSN_LENGTH) return false;
  if (!/^\d+$/.test(nsn)) return false;
  return (
    nsn.startsWith(ETHIO_TELECOM_MOBILE_LEAD) ||
    nsn.startsWith(SAFARICOM_ETHIOPIA_MOBILE_LEAD)
  );
}

/**
 * Normalizes an Ethiopian mobile phone number to canonical E.164 form.
 *
 * Returns null for invalid or non-Ethiopian input rather than throwing, so
 * callers can treat failure as an opaque, non-enumerable rejection.
 *
 * @example
 *   normalizeEthiopianPhone("0912345678")   // "+251912345678"
 *   normalizeEthiopianPhone("+251712345678")// "+251712345678"
 *   normalizeEthiopianPhone("+1 555 0100") // null
 *   normalizeEthiopianPhone("0812345678")   // null (unknown prefix)
 */
export function normalizeEthiopianPhone(input: string): EthiopianPhone | null {
  if (typeof input !== "string") return null;

  const cleaned = stripFormatting(input);
  if (!cleaned) return null;

  let nsn: string;
  if (cleaned.startsWith(E164_PREFIX)) {
    nsn = cleaned.slice(E164_PREFIX.length);
  } else if (cleaned.startsWith(ETHIOPIA_COUNTRY_CODE)) {
    // "251..." without the leading plus
    nsn = cleaned.slice(ETHIOPIA_COUNTRY_CODE.length);
  } else if (cleaned.startsWith("0")) {
    // Local format: strip the national trunk prefix 0.
    nsn = cleaned.slice(1);
  } else {
    return null;
  }

  if (!isValidEthiopianMobileNsn(nsn)) return null;
  return brand(`${E164_PREFIX}${nsn}`);
}
