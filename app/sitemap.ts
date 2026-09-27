import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/utils";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = absoluteUrl("/").origin;

  const routes = [
    "",
    "/a-propos",
    "/briefs",
    "/conditions-utilisation",
    "/contact",
    "/cookies",
    "/faq",
    "/mentions-legales",
    "/plan-du-site",
    "/politique-de-confidentialite",
    "/poster",
    "/tokens",
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1 : 0.7,
  }));
}