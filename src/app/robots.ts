import type { MetadataRoute } from "next";
import { absoluteUrl, privateRobotsDisallowPaths } from "@/lib/seo/metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: privateRobotsDisallowPaths(),
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
