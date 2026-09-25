import { describe, expect, it } from "vitest";
import {
  decodeUnlockError,
  normalizeWhatsApp,
  PROJECT_TYPES,
  PROJECT_TYPE_LABELS,
  SENEGAL_CITIES,
  waLink,
} from "@/lib/tokens";

describe("normalizeWhatsApp", () => {
  it("supprime espaces, tirets, points, parenthèses", () => {
    expect(normalizeWhatsApp("+221 77 123-45.67")).toBe("221771234567");
    expect(normalizeWhatsApp("(221) 77 123 45 67")).toBe("221771234567");
  });

  it("retire le préfixe +", () => {
    expect(normalizeWhatsApp("+221771234567")).toBe("221771234567");
  });

  it("retire le préfixe 00 international", () => {
    expect(normalizeWhatsApp("00221771234567")).toBe("221771234567");
  });

  it("convertit le numéro local sénégalais 0… en 221…", () => {
    expect(normalizeWhatsApp("0771234567")).toBe("221771234567");
  });

  it("laisse un numéro déjà en 221 intact", () => {
    expect(normalizeWhatsApp("221771234567")).toBe("221771234567");
  });
});

describe("waLink", () => {
  it("produit un lien wa.me normalisé", () => {
    expect(waLink("+221 77 123 45 67")).toBe("https://wa.me/221771234567");
  });

  it("ne contient pas de caractères invalides", () => {
    expect(waLink("0771234567")).toBe("https://wa.me/221771234567");
  });
});

describe("constants", () => {
  it("a 8 villes dont Autre", () => {
    expect(SENEGAL_CITIES).toHaveLength(8);
    expect(SENEGAL_CITIES).toContain("Autre");
    expect(SENEGAL_CITIES).toContain("Dakar");
  });

  it("a 5 types de projet avec leurs libellés", () => {
    expect(PROJECT_TYPES).toHaveLength(5);
    expect(PROJECT_TYPES).toContain("refonte");
    for (const type of PROJECT_TYPES) {
      expect(PROJECT_TYPE_LABELS[type]).toBeTruthy();
    }
  });
});

describe("decodeUnlockError", () => {
  it("traduit chaque code RPC connu", () => {
    expect(decodeUnlockError("TLNAU", "x")).toContain("connecté");
    expect(decodeUnlockError("TLDUP", "x")).toContain("déjà");
    expect(decodeUnlockError("TLLOW", "x")).toContain("insuffisants");
    expect(decodeUnlockError("TLAAC", "x")).toContain("non autorisé");
    expect(decodeUnlockError("TLCLO", "x")).toContain("plus disponible");
    expect(decodeUnlockError("TLNOR", "x")).toContain("existe plus");
    expect(decodeUnlockError("TLNOD", "x")).toContain("compte développeur");
  });

  it("retombe sur le message fourni", () => {
    expect(decodeUnlockError(null, "erreur réseau")).toBe("erreur réseau");
    expect(decodeUnlockError("TLXXX", "erreur réseau")).toBe("erreur réseau");
  });
});