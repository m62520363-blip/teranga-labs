import { COUNTRIES } from "@/lib/countries";

/**
 * Slug d'URL pour une région du périmètre (9 pays d'Afrique de l'Ouest).
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

type RegionSlugEntry = { slug: string; region: string; countryCode: string };

// Toutes les régions du référentiel, dans l'ordre des pays. Un seul nom est
// ambigu (« Savanes » en CI et TG) : on déduplique par slug en gardant la
// première occurrence, ce qui colle au modèle par nom stocké en base.
function buildRegionSlugEntries(): RegionSlugEntry[] {
  const seen = new Set<string>();
  const entries: RegionSlugEntry[] = [];
  for (const country of COUNTRIES) {
    for (const region of country.regions) {
      const slug = slugifyRegion(region.name);
      if (seen.has(slug)) continue;
      seen.add(slug);
      entries.push({ slug, region: region.name, countryCode: country.code });
    }
  }
  return entries;
}

const REGION_SLUG_ENTRIES = buildRegionSlugEntries();

/** Résout un slug vers une région, ou null si la région n'existe pas. */
export function findRegionBySlug(slug: string): string | null {
  return REGION_SLUG_ENTRIES.find((e) => e.slug === slug)?.region ?? null;
}

/** Code pays (ISO 2) d'une région résolue par slug, ou null. */
export function countryCodeForRegionSlug(slug: string): string | null {
  return REGION_SLUG_ENTRIES.find((e) => e.slug === slug)?.countryCode ?? null;
}

/** Toutes les paires { slug, region, countryCode }, pour generateStaticParams ou le sitemap. */
export function allRegionSlugs(): RegionSlugEntry[] {
  return REGION_SLUG_ENTRIES;
}
