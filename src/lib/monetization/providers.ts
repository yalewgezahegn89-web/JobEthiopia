/**
 * Ad-provider registry (provider-neutral).
 *
 * Phase 14 ships one deliberately first-party reference provider: `house`
 * (JobEthiopia's own clearly-labeled feature ads, non-tracking, consent-free).
 * Every slot renders nothing until `MONETIZATION_ENABLED=true` AND
 * `AD_PROVIDER` selects a registered provider — the default is inert. Future
 * networks register here and are selected the same way; providers are strictly
 * server-side (CSP forbids third-party scripts/frames) and each render only
 * receives a placement id, pathname, and locale.
 */
import type { AdProvider } from "./config";
import { getHouseAd } from "./houseAds";

const REGISTERED_PROVIDERS: readonly AdProvider[] = [
  {
    id: "house",
    tracking: false,
    render: (context) => getHouseAd(context),
  },
];

export function getAdProvider(): AdProvider | null {
  const providerId = process.env.AD_PROVIDER;
  if (!providerId) return null;
  const provider = REGISTERED_PROVIDERS.find(
    (candidate) => candidate.id === providerId,
  );
  return provider ?? null;
}

export function isRegisteredProvider(id: string): boolean {
  return REGISTERED_PROVIDERS.some((candidate) => candidate.id === id);
}

export function getRegisteredProviderIds(): readonly string[] {
  return REGISTERED_PROVIDERS.map((candidate) => candidate.id);
}

export function listRegisteredProviders(): readonly AdProvider[] {
  return REGISTERED_PROVIDERS;
}