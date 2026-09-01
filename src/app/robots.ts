import type { MetadataRoute } from "next";
import { getAppBaseUrl } from "@/lib/appBaseUrl";

function siteUrl(): URL {
  return new URL(getAppBaseUrl());
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
