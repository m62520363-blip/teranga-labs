import type { MetadataRoute } from "next";
import { META } from "@/components/landing/content";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = META.url || "https://terangalabs.sn";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/dashboard", "/auth/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}