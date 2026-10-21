import { describe, expect, it } from "vitest";
import { COUNTRIES } from "@/lib/countries";
import {
  convertFcfa,
  formatLocalPrice,
  isKnownCurrency,
  ratePerFcfa,
} from "@/lib/currency";
import {
  findWorldCountryByName,
  getWorldCountry,
  getWorldRegions,
  WORLD_COUNTRIES,
  WORLD_COUNTRIES_COUNT,
  WORLD_COUNTRY_ITEMS,
  WORLD_PHONE_COUNTRIES,
  parseWorldDial,
} from "@/lib/world-countries";

describe("WORLD_COUNTRIES (inscription monde)", () => {
  it("couvre le monde sans exception (≥ 190 pays et territoires)", () => {
    expect(WORLD_COUNTRIES_COUNT).toBeGreaterThanOrEqual(190);
    expect(WORLD_COUNTRIES_COUNT).toBe(WORLD_COUNTRIES.length);
  });

  it("a des ISO2 uniques et triés par nom français", () => {
    const iso2 = WORLD_COUNTRIES.map((c) => c.iso2);
    expect(new Set(iso2).size).toBe(iso2.length);
    const names = WORLD_COUNTRIES.map((c) => c.nameFr);
    expect(new Set(names).size).toBe(names.length);
    const sorted = [...names].sort((a, b) => a.localeCompare(b, "fr"));
    expect(names).toEqual(sorted);
  });

  it("chaque pays a un indicatif valide et une devise connue de lib/currency", () => {
    for (const c of WORLD_COUNTRIES) {
      expect(c.dial, c.iso2).toMatch(/^\+[0-9]{1,4}$/);
      expect(isKnownCurrency(c.currency), `${c.iso2} → ${c.currency}`).toBe(true);
    }
  });

  it("intègre les 9 pays du périmètre avec leur devise du référentiel", () => {
    for (const scope of COUNTRIES) {
      const world = getWorldCountry(scope.iso2);
      expect(world, scope.iso2).toBeTruthy();
      expect(world!.dial).toBe(scope.phoneCode);
      expect(world!.currency).toBe(scope.currency);
      expect(world!.nameFr).toBe(scope.nameFr);
    }
  });

  it("présente les grandes économies attendues", () => {
    for (const iso2 of ["US", "FR", "GB", "DE", "JP", "CN", "IN", "BR", "CA", "AU", "ZA", "NG", "MA", "SN"]) {
      expect(getWorldCountry(iso2), iso2).toBeTruthy();
    }
    expect(getWorldCountry("FR")!.currency).toBe("EUR");
    expect(getWorldCountry("US")!.currency).toBe("USD");
    expect(getWorldCountry("GB")!.currency).toBe("GBP");
    expect(getWorldCountry("JP")!.currency).toBe("JPY");
  });

  it("résout un libellé de pays stocké (users.country) vers la devise", () => {
    expect(findWorldCountryByName("Sénégal")?.iso2).toBe("SN");
    expect(findWorldCountryByName("sénégal")?.iso2).toBe("SN");
    expect(findWorldCountryByName("États-Unis")?.iso2).toBe("US");
    expect(findWorldCountryByName("France")?.iso2).toBe("FR");
    expect(findWorldCountryByName("  Côte d'Ivoire ")?.iso2).toBe("CI");
    expect(findWorldCountryByName("Pays inexistant")).toBeUndefined();
    expect(findWorldCountryByName(null)).toBeUndefined();
  });

  it("expose une map valeur→libellé pour les Select", () => {
    expect(WORLD_COUNTRY_ITEMS.SN).toBe("Sénégal");
    expect(Object.keys(WORLD_COUNTRY_ITEMS).length).toBe(WORLD_COUNTRIES.length);
  });
});

describe("WORLD_PHONE_COUNTRIES (indicatif)", () => {
  it("déduplique les dials partagés (+1 US/CA, +7 RU/KZ) sans perdre de pays", () => {
    const dials = WORLD_PHONE_COUNTRIES.map((c) => c.dial);
    expect(new Set(dials).size).toBe(dials.length);
    expect(WORLD_PHONE_COUNTRIES.length).toBeGreaterThanOrEqual(190);
    expect(WORLD_PHONE_COUNTRIES.length).toBeLessThan(WORLD_COUNTRIES.length);
  });

  it("garde les 9 dials du périmètre, un par option", () => {
    for (const scope of COUNTRIES) {
      const matches = WORLD_PHONE_COUNTRIES.filter((c) => c.dial === scope.phoneCode);
      expect(matches, scope.phoneCode).toHaveLength(1);
      expect(matches[0].nameFr).toBe(scope.nameFr);
    }
  });
});

describe("parseWorldDial", () => {
  it("reconnaît les indicatifs du périmètre", () => {
    expect(parseWorldDial("+221771234567")).toEqual({ dial: "+221", national: "771234567" });
    expect(parseWorldDial("77 123 45 67")).toEqual({ dial: "+221", national: "771234567" });
    expect(parseWorldDial("+33612345678")).toEqual({ dial: "+33", national: "612345678" });
  });

  it("préfère le dial le plus long (Bahamas avant États-Unis)", () => {
    expect(parseWorldDial("+12423333333").dial).toBe("+1242");
    expect(parseWorldDial("+16135551234").dial).toBe("+1");
    expect(parseWorldDial("+14155552671").dial).toBe("+1");
  });

  it("tombe sur l indicatif du siège sans correspondance", () => {
    expect(parseWorldDial("").dial).toBe("+221");
    expect(parseWorldDial("999").dial).toBe("+221");
  });
});

describe("getWorldRegions", () => {
  it("lit les 9 pays du périmètre dans lib/countries (source unique)", () => {
    expect(getWorldRegions("SN")).toHaveLength(COUNTRIES[0].regions.length);
    expect(getWorldRegions("SN")).toContain("Dakar");
    expect(getWorldRegions("ML")).toContain("Bamako");
  });

  it("expose les régions curées des pays majeurs", () => {
    expect(getWorldRegions("FR").length).toBeGreaterThanOrEqual(18);
    expect(getWorldRegions("US").length).toBeGreaterThanOrEqual(50);
    expect(getWorldRegions("JP")).toHaveLength(47);
    expect(getWorldRegions("DE")).toHaveLength(16);
    expect(getWorldRegions("GB")).toEqual([
      "Angleterre",
      "Écosse",
      "Pays de Galles",
      "Irlande du Nord",
    ]);
  });

  it("retourne [] pour un pays sans liste (saisie libre côté formulaire)", () => {
    expect(getWorldRegions("IS")).toEqual([]);
    expect(getWorldRegions(null)).toEqual([]);
    expect(getWorldRegions("ZZ")).toEqual([]);
  });

  it("ne duplique jamais une région dans un même pays", () => {
    for (const c of WORLD_COUNTRIES) {
      const regions = getWorldRegions(c.iso2);
      expect(new Set(regions).size, c.iso2).toBe(regions.length);
    }
  });
});

describe("lib/currency", () => {
  it("ancre le FCFA sur lui-même et l euro sur le peg officiel", () => {
    expect(ratePerFcfa("XOF")).toBe(1);
    expect(convertFcfa(655_957, "EUR")).toBeCloseTo(1000, 0);
    expect(ratePerFcfa("XXX")).toBeNull();
  });

  it("convertit le prix d un Token dans les grandes devises", () => {
    const usd = convertFcfa(2500, "USD")!;
    expect(usd).toBeGreaterThan(3);
    expect(usd).toBeLessThan(6);
    const eur = convertFcfa(2500, "EUR")!;
    expect(eur).toBeGreaterThan(3);
    expect(eur).toBeLessThan(5);
    expect(convertFcfa(2500, null)).toBeNull();
  });

  it("formate en devise locale via Intl (symbole officiel)", () => {
    expect(formatLocalPrice(2500, "USD")).toMatch(/\$\s?US|US\$/);
    expect(formatLocalPrice(2500, "XOF")).toMatch(/F\s*CFA/);
    expect(formatLocalPrice(655_957, "EUR")).toContain("€");
    expect(formatLocalPrice(2500, "EUR", "en")).toMatch(/€/);
    expect(formatLocalPrice(2500, null)).toBeNull();
  });

  it("connaît la devise de TOUS les pays du référentiel monde", () => {
    for (const c of WORLD_COUNTRIES) {
      expect(isKnownCurrency(c.currency), `${c.iso2} → ${c.currency}`).toBe(true);
    }
  });
});
