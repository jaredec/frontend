import type { MetadataRoute } from "next";
import { CURRENT_FRANCHISE_CODES } from "@/lib/mlb-data";

export default function sitemap(): MetadataRoute.Sitemap {
  const teamPages = CURRENT_FRANCHISE_CODES.map((code) => ({
    url: `https://mlbscorigami.com/team/${code.toLowerCase()}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  return [
    {
      url: "https://mlbscorigami.com",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: "https://mlbscorigami.com/about",
      lastModified: new Date("2025-01-01"),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    },
    ...teamPages,
  ];
}
