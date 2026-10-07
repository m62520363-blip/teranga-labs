import { describe, expect, it } from "vitest";
import {
  allCountrySlugs,
  countryCodeForPlace,
  countryForPlace,
  findCountryBySlug,
  findRegionByPlace,
} from "@/lib/geography";

describe("allCountrySlugs", () => {
  it("couvre les 9 pays du périmètre (§2)", () => {
    expect(allCountrySlugs()).toHaveLength(9);
  });

  it("produit des slugs uniques, donc pas de collision d URL", () => {
    const slugs = allCountrySlugs().map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("fait l aller-retour slug -> pays", () => {
    for (const { slug } of allCountrySlugs()) {
      expect(findCountryBySlug(slug)).toBeTruthy();
    }
  });
});

describe("countryCodeForPlace", () => {
  it("résout un nom de pays accentué", () => {
    expect(countryCodeForPlace("Sénégal")).toBe("SN");
    expect(countryCodeForPlace("Côte d'Ivoire")).toBe("CI");
  });

  it("résout une région du référentiel", () => {
    expect(countryCodeForPlace("Dakar")).toBe("SN");
    expect(countryCodeForPlace("Bamako")).toBe("ML");
  });

  it("résout un code ISO en minuscules", () => {
    expect(countryCodeForPlace("gn")).toBe("GN");
  });

  it("retourne null pour une localité hors périmètre", () => {
    expect(countryCodeForPlace("Paris")).toBeNull();
    expect(countryCodeForPlace(null)).toBeNull();
    expect(countryCodeForPlace("  ")).toBeNull();
  });
});

describe("findRegionByPlace", () => {
  it("résout un nom de région", () => {
    const r = findRegionByPlace("Dakar");
    expect(r).toMatchObject({ name: "Dakar", countryCode: "SN" });
    expect(r?.code).toBeTruthy();
  });

  it("résout un slug de région", () => {
    expect(findRegionByPlace("saint-louis")?.name).toBe("Saint-Louis");
  });

  it("retourne null pour un pays (pas une région)", () => {
    expect(findRegionByPlace("Sénégal")).toBeNull();
  });

  it("retourne null pour une localité inconnue", () => {
    expect(findRegionByPlace("Tombouctou inconnue")).toBeNull();
  });
});

describe("countryForPlace", () => {
  it("fournit le libellé sûr du pays correspondant", () => {
    expect(countryForPlace("Ziguinchor")).toEqual({ code: "SN", nameFr: "Sénégal" });
  });
});