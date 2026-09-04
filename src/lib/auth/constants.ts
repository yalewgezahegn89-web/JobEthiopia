export const SESSION_COOKIE_NAME = "session";

export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Audit event names for the phone/OTP authentication lifecycle.
 * Raw OTP values must never be placed in audit metadata.
 */
export const OTP_AUDIT_ACTIONS = {
  OTP_REQUESTED: "OTP_REQUESTED",
  OTP_VERIFIED: "OTP_VERIFIED",
  OTP_FAILED: "OTP_FAILED",
  PHONE_LINKED: "PHONE_LINKED",
  PHONE_LOGIN_SUCCESS: "PHONE_LOGIN_SUCCESS",
  PHONE_LOGIN_FAILURE: "PHONE_LOGIN_FAILURE",
  PHONE_SIGNUP_SUCCESS: "PHONE_SIGNUP_SUCCESS",
} as const;