import type { MetadataRoute } from "next";

function siteUrl(): URL {
  return new URL(
    process.env.APP_BASE_URL?.trim() || "http://localhost:3000",
  );
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return ["/", "/jobs", "/careers"].map((path) => ({
    url: new URL(path, base).toString(),
  }));
}
