import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo/metadata";
import { buildPublicSitemapUrls } from "@/lib/sitemap/publicSitemap";

// Generate sitemap entries at request time so CI builds do not require a live database.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const urls = await buildPublicSitemapUrls();
  return urls.map((entry) => ({
    url: absoluteUrl(entry.path),
    lastModified: entry.lastModified,
    alternates: entry.alternates
      ? {
          languages: Object.fromEntries(
            Object.entries(entry.alternates.languages).map(([locale, path]) => [
              locale,
              absoluteUrl(path),
            ]),
          ),
        }
      : undefined,
  }));
}
