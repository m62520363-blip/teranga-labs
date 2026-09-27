import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/utils";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = absoluteUrl("/").origin;

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/auth/",
        "/client",
        "/conversations",
        "/dashboard",
        "/login",
        "/notifications",
        "/parametres",
        "/signup",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}