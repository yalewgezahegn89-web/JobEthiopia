/** Canonical, locale-free legal page identifiers. */
export const LEGAL_PAGE_KEYS = ["privacy", "terms", "cookies"] as const;

export type LegalPageKey = (typeof LEGAL_PAGE_KEYS)[number];

/** Canonical, locale-free path for a legal page (middleware handles prefixes). */
export function legalPagePath(key: LegalPageKey): string {
  return `/${key}`;
}
