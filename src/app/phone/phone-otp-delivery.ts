/**
 * DEVELOPMENT / STAGING-ONLY OTP delivery gate (application boundary).
 *
 * The phone OTP system fully generates, hashes, and stores codes, but the SMS
 * transport is intentionally not wired yet. To verify the browser flow in
 * staging WITHOUT a real SMS provider and WITHOUT a production security hole,
 * this module exposes an explicitly opt-in, non-production delivery callback
 * that prints the code to the server log.
 *
 * The deployment type is discriminated by the environment Vercel explicitly
 * provides, `VERCEL_ENV` (NOT NODE_ENV, which Vercel sets to "production" for
 * ALL deployments including Previews). Logging is enabled only when BOTH of:
 *   - VERCEL_ENV !== "production"  (Vercel Production hard guard), AND
 *   - PHONE_OTP_DEV_DELIVERY === "log"  (explicit opt-in flag).
 *
 * Concretely:
 *   - VERCEL_ENV === "preview" + flag=log            -> enabled
 *   - VERCEL_ENV === "preview" + no flag             -> disabled
 *   - VERCEL_ENV === "production" + flag=log/no flag -> disabled (always)
 *   - local/development (VERCEL_ENV unset) + flag=log -> enabled (preserves
 *     the previous local-dev behavior), no flag -> disabled.
 *
 * Production is therefore impossible to log OTPs for even when the flag is set:
 * whenever VERCEL_ENV === "production" the callback is never constructed.
 *
 * This module sits at the application delivery boundary (imported by the phone
 * server actions) and deliberately does NOT log from the lower-level
 * requestOtp service, keeping production behavior unchanged. The raw OTP is
 * never returned to any client and never logged outside this callback.
 */

export interface OtpDeliveryEnv {
  vercelEnv?: string;
  phoneOtpDevDelivery?: string;
}

export interface DevOtpPayload {
  phone: string;
  requestId: string;
  code: string;
}

export type DevOtpDelivery =
  | ((payload: DevOtpPayload) => Promise<void>)
  | undefined;

/**
 * Pure, injectable resolver for the development OTP delivery callback.
 *
 * Returns the dev delivery callback only when the opt-in flag is active AND
 * the process is NOT running in Vercel production. Returns `undefined` (no
 * delivery) in every other case, including when the flag is absent (the
 * default) or when VERCEL_ENV === "production".
 *
 * It is a pure function of its env argument so it can be unit-tested without
 * mutating process.env, while the production guard remains unconditional.
 */
export function resolveDevOtpDelivery(
  env: OtpDeliveryEnv,
): DevOtpDelivery {
  const isVercelProduction = env.vercelEnv === "production";
  const flagActive = env.phoneOtpDevDelivery === "log";
  if (isVercelProduction || !flagActive) return undefined;

  return async ({ phone, requestId, code }) => {
    // Development-only log, clearly prefixed. Never emitted in Vercel
    // production (this callback is only reachable when VERCEL_ENV !==
    // "production").
    console.log(
      `[phone-otp-dev] requestId=${requestId} phone=${phone} code=${code}`,
    );
  };
}

/**
 * Convenience wrapper that reads the real environment and returns the options
 * to forward to requestOtp. Keeps the process.env access at the action boundary.
 */
export function devOtpRequestOptions(): {
  deliver: DevOtpDelivery;
} {
  const deliver = resolveDevOtpDelivery({
    vercelEnv: process.env.VERCEL_ENV,
    phoneOtpDevDelivery: process.env.PHONE_OTP_DEV_DELIVERY,
  });
  return { deliver };
}
