import type { MetadataRoute } from "next";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { buildPublicSitemapUrls } from "@/lib/sitemap/publicSitemap";

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