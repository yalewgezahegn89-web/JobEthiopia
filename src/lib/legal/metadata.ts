import type { Metadata } from "next";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { LOCALE_METADATA } from "@/lib/i18n/locale";
import { getCurrentLocale } from "@/lib/i18n/server";
import { buildPageMetadata, languageAlternates } from "@/lib/seo/metadata";
import { getLegalContent } from "./content";
import { legalPagePath, type LegalPageKey } from "./paths";

/** Absolute-URL language alternates for one legal page. */
export function legalLanguageAlternates(
  base: string,
  key: LegalPageKey,
): Record<string, string> {
  return languageAlternates(legalPagePath(key), {
    base,
    includeXDefault: true,
  });
}

/** Localized metadata with self-referencing canonical and hreflang alternates. */
export async function buildLegalMetadata(key: LegalPageKey): Promise<Metadata> {
  const locale = await getCurrentLocale();
  const document = getLegalContent(locale)[key];
  const base = getAppBaseUrl();

  return buildPageMetadata({
    path: legalPagePath(key),
    locale,
    baseUrl: base,
    title: document.metaTitle,
    description: document.metaDescription,
    absoluteTitle: true,
    includeAlternates: true,
    includeXDefault: true,
    openGraphLocale: LOCALE_METADATA[locale].intl,
  });
}
