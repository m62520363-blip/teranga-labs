import { SENEGAL_REGIONS } from "@/lib/tokens";

/**
 * Slug d'URL pour une région du Sénégal.
 *
 * `normalize("NFD")` décompose les caractères accentués pour que
 * « Kédougou » devienne « kedougou », et non une URL encodée en
 * pourcentage illisible.
 */
export function slugifyRegion(region: string): string {
  return region
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Résout un slug vers une région, ou null si la région n'existe pas. */
export function findRegionBySlug(slug: string): string | null {
  return SENEGAL_REGIONS.find((r) => slugifyRegion(r) === slug) ?? null;
}

/** Toutes les paires { slug, region }, prêtes pour generateStaticParams ou le sitemap. */
export function allRegionSlugs(): { slug: string; region: string }[] {
  return SENEGAL_REGIONS.map((region) => ({ slug: slugifyRegion(region), region }));
}
