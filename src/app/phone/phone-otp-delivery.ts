/**
 * DEVELOPMENT / STAGING-ONLY OTP delivery gate (application boundary).
 *
 * The phone OTP system fully generates, hashes, and stores codes, but the SMS
 * transport is intentionally not wired yet. To verify the browser flow in
 * staging WITHOUT a real SMS provider and WITHOUT a production security hole,
 * this module exposes an explicitly opt-in, non-production delivery callback
 * that prints the code to the server log.
 *
 * Production is guaranteed inert even when PHONE_OTP_DEV_DELIVERY=log is set
 * in the environment: the delivery callback is only attached when BOTH of:
 *   - NODE_ENV !== "production"  (non-production guard), AND
 *   - PHONE_OTP_DEV_DELIVERY === "log"  (explicit opt-in flag).
 *
 * This module sits at the application delivery boundary (imported by the phone
 * server actions) and deliberately does NOT log from the lower-level
 * requestOtp service, keeping production behavior unchanged. The raw OTP is
 * never returned to any client and never logged outside this callback.
 */

export interface OtpDeliveryEnv {
  nodeEnv?: string;
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
 * the process is NOT running in production. Returns `undefined` (no delivery)
 * in every other case, including when the flag is absent (the default).
 *
 * It is a pure function of its env argument so it can be unit-tested without
 * mutating process.env, while the production guard remains unconditional.
 */
export function resolveDevOtpDelivery(
  env: OtpDeliveryEnv,
): DevOtpDelivery {
  const isProduction = env.nodeEnv === "production";
  const flagActive = env.phoneOtpDevDelivery === "log";
  if (isProduction || !flagActive) return undefined;

  return async ({ phone, requestId, code }) => {
    // Development-only log, clearly prefixed. Never emitted in production
    // (this callback is only reachable when NODE_ENV !== "production").
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
    nodeEnv: process.env.NODE_ENV,
    phoneOtpDevDelivery: process.env.PHONE_OTP_DEV_DELIVERY,
  });
  return { deliver };
}
