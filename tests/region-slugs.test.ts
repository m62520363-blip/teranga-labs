import { describe, expect, it } from "vitest";
import {
  allRegionSlugs,
  countryCodeForRegionSlug,
  findRegionBySlug,
  slugifyRegion,
} from "@/lib/region-slugs";
import { ALL_REGION_NAMES } from "@/lib/countries";

describe("slugifyRegion", () => {
  it("supprime les accents", () => {
    expect(slugifyRegion("Kédougou")).toBe("kedougou");
    expect(slugifyRegion("Sédhiou")).toBe("sedhiou");
  });

  it("conserve les regions sans accent", () => {
    expect(slugifyRegion("Dakar")).toBe("dakar");
  });

  it("minusculise et remplace les separateurs", () => {
    expect(slugifyRegion("Saint-Louis")).toBe("saint-louis");
  });

  it("ne produit ni tiret en tete ni en fin", () => {
    const slug = slugifyRegion("  Thiès  ");
    expect(slug).toBe("thies");
    expect(slug.startsWith("-")).toBe(false);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("findRegionBySlug", () => {
  it("resout une region accentuee depuis son slug", () => {
    expect(findRegionBySlug("kedougou")).toBe("Kédougou");
  });

  it("resout une region composee", () => {
    expect(findRegionBySlug("saint-louis")).toBe("Saint-Louis");
  });

  it("retourne null pour un slug inconnu", () => {
    expect(findRegionBySlug("paris")).toBeNull();
  });

  it("ne confond pas deux regions aux slugs proches", () => {
    expect(findRegionBySlug("thies")).not.toBe(findRegionBySlug("tivaouane"));
  });
});

describe("allRegionSlugs", () => {
  it("couvre toutes les regions du perimetre (9 pays)", () => {
    // « Savanes » (CI + TG) est deduplique par slug : 93 regions -> 92 slugs.
    expect(allRegionSlugs()).toHaveLength(ALL_REGION_NAMES.length);
    expect(allRegionSlugs().length).toBe(92);
  });

  it("produit des slugs uniques, donc pas de collision d URL", () => {
    const slugs = allRegionSlugs().map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("associe un code pays a chaque slug", () => {
    for (const entry of allRegionSlugs()) {
      expect(entry.countryCode).toMatch(/^[A-Z]{2}$/);
      expect(countryCodeForRegionSlug(entry.slug)).toBe(entry.countryCode);
    }
  });

  it("fait l aller-retour slug -> region pour chaque region", () => {
    for (const { slug } of allRegionSlugs()) {
      expect(findRegionBySlug(slug)).toBeTruthy();
    }
  });

  it("couvre chaque pays du perimetre", () => {
    const codes = new Set(allRegionSlugs().map((r) => r.countryCode));
    expect(codes).toEqual(new Set(["SN", "CI", "ML", "BF", "NE", "GN", "GW", "BJ", "TG"]));
  });
});
