import { describe, expect, it } from "vitest";
import { COUNTRIES, getFlagUrl } from "@/lib/countries";

/**
 * flagcdn ne publie que des largeurs « × 20 » (20, 40, 80, 160, 320, …).
 * Toute autre largeur renvoie un 404 — constaté à l'exécution sur w16
 * (phone-input), w24 (/pays/[slug]) et w48 (/pays), où chaque drapeau du
 * périmètre était cassé. Le test verrouille la règle sans réseau.
 */
const PUBLISHED_WIDTHS = [20, 40, 80, 160, 320, 640, 1280];

function widthOf(url: string): number {
  const m = /\/w(\d+)\//.exec(url);
  expect(m, `largeur présente dans ${url}`).toBeTruthy();
  return Number(m![1]);
}

describe("getFlagUrl", () => {
  it("n'émet que des largeurs réellement publiées par flagcdn", () => {
    for (const country of COUNTRIES) {
      for (const size of [16, 20, 24, 32, 48] as const) {
        const url = getFlagUrl(country.code, size);
        expect(
          PUBLISHED_WIDTHS,
          `${country.code} @${size}px -> ${url}`
        ).toContain(widthOf(url));
      }
    }
  });

  it("arrondit vers le haut pour ne jamais perdre en netteté", () => {
    expect(widthOf(getFlagUrl("SN", 16))).toBeGreaterThanOrEqual(16);
    expect(widthOf(getFlagUrl("SN", 24))).toBeGreaterThanOrEqual(24);
    expect(widthOf(getFlagUrl("SN", 48))).toBeGreaterThanOrEqual(48);
    expect(widthOf(getFlagUrl("SN", 48))).toBe(80);
  });

  it("conserve le pays attendu dans l'URL", () => {
    for (const country of COUNTRIES) {
      expect(getFlagUrl(country.code, 20)).toContain(
        `/${country.iso2.toLowerCase()}.png`
      );
    }
  });

  it("sans code pays, tombe sur un drapeau neutre existant", () => {
    // « xx.png » n'existe pas chez flagcdn (404) : le fallback doit servir
    // « un.png », la seule entrée neutre réellement publiée.
    const url = getFlagUrl(undefined, 20);
    expect(url).toContain("/un.png");
    expect(PUBLISHED_WIDTHS).toContain(widthOf(url));
    expect(getFlagUrl(null, 16)).toContain("/un.png");
    expect(getFlagUrl("", 48)).toContain("/un.png");
  });

  it("un code pays hors référentiel reste une URL de largeur valide", () => {
    expect(PUBLISHED_WIDTHS).toContain(widthOf(getFlagUrl("zz", 24)));
  });
});
