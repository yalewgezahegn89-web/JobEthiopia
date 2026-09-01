import type { MetadataRoute } from "next";
import { getAppBaseUrl } from "@/lib/appBaseUrl";

function siteUrl(): URL {
  return new URL(getAppBaseUrl());
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return ["/", "/jobs", "/careers"].map((path) => ({
    url: new URL(path, base).toString(),
  }));
}
