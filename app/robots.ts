import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/ops",
    },
    sitemap: "https://mlbscorigami.com/sitemap.xml",
  };
}
