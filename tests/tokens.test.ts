import { describe, expect, it } from "vitest";
import {
  decodeUnlockError,
  normalizeWhatsApp,
  PROJECT_TYPES,
  PROJECT_TYPE_LABELS,
  SENEGAL_REGIONS,
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

  it("ne force plus d'indicatif sur un numéro sans pays", () => {
    // Un numéro « 0… » local est ambigu hors Sénégal : on le laisse tel quel
    // (PhoneInput préfixe toujours l'indicatif sélectionné).
    expect(normalizeWhatsApp("0771234567")).toBe("0771234567");
  });

  it("normalise un numéro d'un autre pays du bassin", () => {
    expect(normalizeWhatsApp("+223 76 12 34 56")).toBe("22376123456");
    expect(normalizeWhatsApp("+225 07 08 09 10 11")).toBe("2250708091011");
    expect(normalizeWhatsApp("+226 70 12 34 56")).toBe("22670123456");
  });

  it("laisse un numéro déjà international intact", () => {
    expect(normalizeWhatsApp("221771234567")).toBe("221771234567");
  });
});

describe("waLink", () => {
  it("produit un lien wa.me normalisé", () => {
    expect(waLink("+221 77 123 45 67")).toBe("https://wa.me/221771234567");
  });

  it("produit un lien pour un autre pays", () => {
    expect(waLink("+223 76 12 34 56")).toBe("https://wa.me/22376123456");
  });
});

describe("constants", () => {
  it("a les 14 régions du Sénégal, sans Autre", () => {
    expect(SENEGAL_REGIONS).toHaveLength(14);
    expect(SENEGAL_REGIONS).not.toContain("Autre");
    expect(SENEGAL_REGIONS).not.toContain("Touba");
    expect(SENEGAL_REGIONS).toContain("Dakar");
    expect(SENEGAL_REGIONS).toContain("Thiès");
    expect(SENEGAL_REGIONS).toContain("Ziguinchor");
    expect(SENEGAL_REGIONS).toContain("Kédougou");
    expect(SENEGAL_REGIONS).toContain("Sédhiou");
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