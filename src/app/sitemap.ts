import type { MetadataRoute } from "next";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { buildPublicSitemapUrls } from "@/lib/sitemap/publicSitemap";

// Generate sitemap entries at request time so CI builds do not require a live database.
export const dynamic = "force-dynamic";

function siteUrl(): string {
  return getAppBaseUrl().replace(/\/$/, "");
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const urls = await buildPublicSitemapUrls();
  return urls.map((entry) => ({
    url: `${base}${entry.path}`,
    lastModified: entry.lastModified,
  }));
}
