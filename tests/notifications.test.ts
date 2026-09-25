import { describe, it, expect } from "vitest";
import {
  buildClientConfirmationMessage,
  buildDeveloperMatchMessage,
  summarizeBrief,
  keywordsForType,
  PROJECT_TYPE_KEYWORDS,
} from "@/lib/notifications/messages";
import { briefFreshness, formatFCFA } from "@/lib/formatting";

const ORIGIN = "http://localhost:3000";

const clientPayload = {
  request_id: "11111111-1111-1111-1111-111111111111",
  client_name: "Boutique Bazin",
  client_whatsapp: "+221771234567",
  client_city: "Dakar",
  project_type: "e-commerce",
  budget: 250000,
  management_key: "22222222-2222-2222-2222-222222222222",
};

const devPayload = {
  request_id: "11111111-1111-1111-1111-111111111111",
  client_name: "Boutique Bazin",
  client_city: "Dakar",
  project_type: "e-commerce",
  budget: 250000,
};

describe("messages de notification de brief", () => {
  it("contient le lien de suivi du client avec sa clé de gestion", () => {
    const msg = buildClientConfirmationMessage(clientPayload, ORIGIN);
    expect(msg).toContain(clientPayload.client_name);
    expect(msg).toContain(`${ORIGIN}/brief/${clientPayload.request_id}?key=${clientPayload.management_key}`);
    expect(msg).toContain("ne le partagez pas");
  });

  it("résume le brief (type · ville · budget)", () => {
    const summary = summarizeBrief(clientPayload);
    expect(summary).toContain("E-commerce");
    expect(summary).toContain("Dakar");
    expect(summary).toContain(formatFCFA(250000));
  });

  it("fournit un lien vers la liste des briefs pour les développeurs", () => {
    const msg = buildDeveloperMatchMessage(devPayload, ORIGIN);
    expect(msg).toContain(`${ORIGIN}/briefs`);
    expect(msg).toContain("Nouveau brief sur Teranga Labs");
  });

  it("ne contient jamais la clé de gestion dans le message aux développeurs", () => {
    const msg = buildDeveloperMatchMessage(devPayload, ORIGIN);
    expect(msg).not.toContain("management_key");
    expect(msg).not.toContain(clientPayload.management_key);
  });
});

describe("keywordsForType", () => {
  it("couvre les quatre types de projets", () => {
    expect(PROJECT_TYPE_KEYWORDS).toHaveProperty("vitrine");
    expect(PROJECT_TYPE_KEYWORDS).toHaveProperty("e-commerce");
    expect(PROJECT_TYPE_KEYWORDS).toHaveProperty("landing page");
    expect(PROJECT_TYPE_KEYWORDS).toHaveProperty("app web");
  });

  it("retourne les mots-clés correspondant au type", () => {
    expect(keywordsForType("e-commerce")).toContain("e-commerce");
    expect(keywordsForType("vitrine")).not.toContain("ecommerce");
  });

  it("retourne une liste vide pour un type inconnu", () => {
    expect(keywordsForType("inconnu")).toEqual([]);
  });
});

describe("briefFreshness (badges)", () => {
  const now = Date.now();
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();

  it("badge « Moins de 24h » sous 24 h", () => {
    expect(briefFreshness(iso(60_000))).toBe("h24");
    expect(briefFreshness(iso(23 * 3_600_000))).toBe("h24");
  });

  it("badge « Nouveau » entre 24 h et 72 h", () => {
    expect(briefFreshness(iso(25 * 3_600_000))).toBe("new");
    expect(briefFreshness(iso(3 * 24 * 3_600_000 - 60_000))).toBe("new");
  });

  it("aucun badge au-delà de 72 h", () => {
    expect(briefFreshness(iso(4 * 24 * 3_600_000))).toBe(null);
  });
});