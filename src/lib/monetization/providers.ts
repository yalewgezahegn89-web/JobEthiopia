/**
 * Ad-provider registry (reserved, provider-neutral).
 *
 * No provider ships in Batch 10: the infrastructure is the foundation, so
 * every reserved slot renders nothing until a compliant adapter is registered
 * here and selected through `AD_PROVIDER`. Providers are strictly server-side
 * (CSP forbids third-party scripts/frames) and each render only receives a
 * placement id, pathname, and locale.
 */
import type { AdProvider } from "./config";

const REGISTERED_PROVIDERS: readonly AdProvider[] = [];

export function getAdProvider(): AdProvider | null {
  const providerId = process.env.AD_PROVIDER;
  if (!providerId) return null;
  const provider = REGISTERED_PROVIDERS.find(
    (candidate) => candidate.id === providerId,
  );
  return provider ?? null;
}