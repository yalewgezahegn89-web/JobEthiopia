/**
 * First-party (house) advertising content.
 *
 * House ads promote JobEthiopia's own real features — never fabricated
 * advertisers. Content is copy-keyed so it renders in the visitor's locale
 * through the i18n dictionary, and the selection per placement is
 * deterministic (a stable hash of the placement id), so no personalization or
 * round-robin state is involved. House ads are non-tracking and therefore
 * never consent-gated.
 */
import type { AdContent, AdCopyKey, AdSlotContext } from "./config";

type HouseAdDefinition = {
  id: string;
  href: string;
  titleKey: AdCopyKey;
  bodyKey: AdCopyKey;
};

const HOUSE_ADS: readonly HouseAdDefinition[] = [
  {
    id: "cv-tools",
    href: "/cv",
    titleKey: "cvTitle",
    bodyKey: "cvBody",
  },
  {
    id: "career-resources",
    href: "/careers",
    titleKey: "careersTitle",
    bodyKey: "careersBody",
  },
] as const;

/** Deterministic, placement-anchored index into HOUSE_ADS. */
function stableIndex(seed: string, length: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % length;
}

export function getHouseAd(context: AdSlotContext): AdContent | null {
  const ad = HOUSE_ADS[stableIndex(context.placementId, HOUSE_ADS.length)];
  if (!ad) return null;
  return { href: ad.href, titleKey: ad.titleKey, bodyKey: ad.bodyKey };
}

export function getHouseAdCount(): number {
  return HOUSE_ADS.length;
}
