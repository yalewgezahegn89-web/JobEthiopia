import type { MetadataRoute } from "next";

function siteUrl(): URL {
  return new URL(
    process.env.APP_BASE_URL?.trim() || "http://localhost:3000",
  );
}

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: new URL("/sitemap.xml", base).toString(),
  };
}
