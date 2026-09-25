import type { MetadataRoute } from "next";
import { META } from "@/components/landing/content";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = META.url || "https://terangalabs.sn";

  const routes = [
    "",
    "/a-propos",
    "/briefs",
    "/conditions-utilisation",
    "/contact",
    "/dashboard",
    "/login",
    "/mentions-legales",
    "/plan-du-site",
    "/politique-de-confidentialite",
    "/poster",
    "/signup",
    "/tokens",
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1 : 0.7,
  }));
}