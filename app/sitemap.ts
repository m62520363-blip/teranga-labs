import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/utils";
import { allRegionSlugs } from "@/lib/region-slugs";

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
    "/ville",
  ];

  const staticEntries: MetadataRoute.Sitemap = routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1 : 0.7,
  }));

  // Une URL par région. Les pages sont rendues dynamiquement (elles comptent
  // les briefs réels), donc `lastModified` suit le build plutôt que la
  // dernière publication : on laisse la priorité légèrement sous celle des
  // pages statiques pour ne pas sur-promettre un rafraîchissement.
  const regionEntries: MetadataRoute.Sitemap = allRegionSlugs().map(({ slug }) => ({
    url: `${baseUrl}/ville/${slug}`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 0.6,
  }));

  return [...staticEntries, ...regionEntries];
}