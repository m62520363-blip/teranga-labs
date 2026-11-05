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

/** Toutes les paires { slug, country } du périmètre (Afrique : 54 pays). */
export function allCountrySlugs(): { slug: string; country: Country }[] {
  return COUNTRIES.map((country) => ({
    slug: slugifyPlace(country.nameFr),
    country,
  }));
}

type PlaceMatch = {
  countryCode: string;
  countryName: string;
  regionName: string | null;
  regionCode: string | null;
};

function matchPlace(place: string | null | undefined): PlaceMatch | null {
  const raw = (place ?? "").trim();
  if (!raw) return null;
  const slug = slugifyPlace(raw);
  const normalized = raw.toLowerCase();

  for (const country of COUNTRIES) {
    if (
      normalized === country.nameFr.toLowerCase() ||
      normalized === country.name.toLowerCase() ||
      normalized === country.code.toLowerCase() ||
      normalized === country.iso2.toLowerCase() ||
      normalized === country.iso3.toLowerCase() ||
      slug === slugifyPlace(country.nameFr)
    ) {
      return {
        countryCode: country.code,
        countryName: country.nameFr,
        regionName: null,
        regionCode: null,
      };
    }

    for (const region of country.regions) {
      if (
        normalized === region.name.toLowerCase() ||
        slug === slugifyPlace(region.name) ||
        normalized === region.code.toLowerCase()
      ) {
        return {
          countryCode: country.code,
          countryName: country.nameFr,
          regionName: region.name,
          regionCode: region.code,
        };
      }
    }
  }

  return null;
}

/**
 * Code pays du périmètre (§2) pour une localité libre (client_city),
 * ou null. Correspond à un pays, une région ou un code ISO.
 */
export function countryCodeForPlace(place: string | null | undefined): string | null {
  return matchPlace(place)?.countryCode ?? null;
}

/**
 * Résout une localité (nom libre ou slug de région) vers la région du
 * référentiel. `null.name` sert aussi de libellé sûr pour l'affichage.
 */
export function findRegionByPlace(
  place: string | null | undefined
): { code: string; name: string; countryCode: string } | null {
  const match = matchPlace(place);
  if (!match?.regionCode || !match.regionName) return null;
  return {
    code: match.regionCode,
    name: match.regionName,
    countryCode: match.countryCode,
  };
}

/** Les pays/distinct visibles depuis une localité, sous forme {code, nameFr}. */
export function countryForPlace(
  place: string | null | undefined
): { code: string; nameFr: string } | null {
  const match = matchPlace(place);
  if (!match) return null;
  return { code: match.countryCode, nameFr: match.countryName };
}