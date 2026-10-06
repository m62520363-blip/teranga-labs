import { COUNTRIES, type Country } from "@/lib/countries";

/**
 * Slug d'URL pour un pays / une localité (même normalisation que les
 * régions : NFD + suppression des diacritiques).
 */
export function slugifyPlace(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Résout un slug vers un pays du périmètre, ou null. */
export function findCountryBySlug(slug: string): Country | null {
  return COUNTRIES.find((c) => slugifyPlace(c.nameFr) === slug) ?? null;
}

/** Toutes les paires { slug, country } du périmètre (§2 : 9 pays). */
export function allCountrySlugs(): { slug: string; country: Country }[] {
  return COUNTRIES.map((country) => ({
    slug: slugifyPlace(country.nameFr),
    country,
  }));
}