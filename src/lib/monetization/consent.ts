/**
 * Honest advertising consent gating.
 *
 * The current first-party stack uses no third-party scripts, no cookies, and
 * no PII, so house ads and other non-tracking providers never require consent.
 * A future network that participates in cross-site tracking is consent-gated:
 * the operator must declare it (`AD_CONSENT_REQUIRED=true`) and, because no
 * consent-management UI or CMP exists yet, such providers FAIL CLOSED — slots
 * render nothing rather than render tracking ads without a genuine consent
 * source. This function is the single place to flip when real consent tooling
 * lands.
 *
 * This intentionally does NOT claim GDPR/CCPA compliance or invent a fake
 * consent banner; it documents the required technical control instead.
 */
import type { AdProvider } from "./config";

export type AdConsentRequirement = {
  required: boolean;
  satisfied: boolean;
};

export function readConsentConfig(
  env: NodeJS.ProcessEnv = process.env,
): { required: boolean } {
  return { required: env.AD_CONSENT_REQUIRED === "true" };
}

/** True when the provider's model implies a tracking/consent requirement. */
export function isConsentRequiredFor(provider: Pick<AdProvider, "tracking">): boolean {
  if (!provider.tracking) return false;
  return readConsentConfig().required;
}

/**
 * Whether ad rendering is permitted for a provider. Non-tracking providers
 * (house ads) always pass. Tracking providers only pass when consent is not
 * declared required — and when it IS declared required, we have no consent
 * source yet, so we fail closed.
 */
export function getAdConsentRequirement(
  provider: Pick<AdProvider, "tracking">,
): AdConsentRequirement {
  if (!provider.tracking) {
    return { required: false, satisfied: true };
  }
  if (!readConsentConfig().required) {
    return { required: false, satisfied: true };
  }
  return { required: true, satisfied: false };
}

/** Convenience guard used by the slot component. */
export function isAdRenderingPermitted(
  provider: Pick<AdProvider, "tracking">,
): boolean {
  return getAdConsentRequirement(provider).satisfied;
}
