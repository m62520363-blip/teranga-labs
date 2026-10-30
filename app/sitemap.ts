import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { allRegionSlugs } from "@/lib/region-slugs";
import { allCountrySlugs } from "@/lib/geography";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = absoluteUrl("/").origin;

  const routes = [
    "",
    "/a-propos",
    "/abonnement",
    "/agences",
    "/briefs",
    "/classement",
    "/conditions-utilisation",
    "/contact",
    "/cookies",
    "/dev",
    "/faq",
    "/mentions-legales",
    "/pays",
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

  // Pages pays (géographie statique du référentiel).
  const countryEntries: MetadataRoute.Sitemap = allCountrySlugs().map(({ slug }) => ({
    url: `${baseUrl}/pays/${slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.6,
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

  // Une URL par fiche développeur publique (annuaire réel : seuls les profils
  // approuvés sont indexés, jamais les comptes en attente/refusés).
  const supabase = await createClient();
  let developerEntries: MetadataRoute.Sitemap = [];
  let agencyEntries: MetadataRoute.Sitemap = [];
  if (supabase) {
    const { data } = await supabase.rpc("list_approved_developers", { p_limit: 1000 });
    const rows = (Array.isArray(data) ? data : []) as Array<{
      username?: string | null;
    }>;
    developerEntries = rows
      .filter((d) => d.username)
      .map((d) => ({
        url: `${baseUrl}/dev/${encodeURIComponent(d.username as string)}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.6,
      }));

    // Une URL par fiche agence visible (mêmes critères que la page /agences).
    const { data: agenciesData } = await supabase.rpc("list_agencies", {
      p_limit: 60,
      p_offset: 0,
    });
    const agencies = (Array.isArray(agenciesData) ? agenciesData : []) as Array<{
      slug?: string | null;
    }>;
    agencyEntries = agencies
      .filter((a) => typeof a.slug === "string" && a.slug)
      .map((a) => ({
        url: `${baseUrl}/agences/${encodeURIComponent(a.slug as string)}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.6,
      }));
  }

  return [
    ...staticEntries,
    ...countryEntries,
    ...regionEntries,
    ...developerEntries,
    ...agencyEntries,
  ];
}