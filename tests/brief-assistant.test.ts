import { describe, expect, it } from "vitest";
import { improveBriefWithRules } from "@/lib/ai/brief-assistant";

describe("brief assistant (mode règles)", () => {
  it("nettoie les espaces superflus et garde le fond", () => {
    const input =
      "Je  vends des chaussures   à HLM. Je veux un site   vitrine pro.";
    const out = improveBriefWithRules(input);
    expect(out.description).toContain("Je vends des chaussures à HLM.");
    expect(out.description).not.toContain("  ");
  });

  it("détecte un projet e-commerce et suggère des points utiles", () => {
    const out = improveBriefWithRules(
      "Boutique en ligne : je veux un site e-commerce avec paiement en ligne."
    );
    expect(out.description).toContain("e-commerce");
    const joined = out.suggestions.join(" ").toLowerCase();
    expect(joined).toContain("paiement");
    expect(out.suggestions.length).toBeGreaterThan(0);
  });

  it("complète une description trop courte sans inventer de faits", () => {
    const out = improveBriefWithRules("Créer un site");
    expect(out.description).toContain("Créer un site");
    expect(out.description).toContain("périmètre");
  });

  it("retourne des conseils génériques quand la description est vide", () => {
    const out = improveBriefWithRules("");
    expect(out.description).toBe("");
    expect(out.suggestions.length).toBeGreaterThanOrEqual(3);
  });

  it("ne dépasse pas la longueur maximale de sortie", () => {
    const out = improveBriefWithRules("a".repeat(6000));
    expect(out.description.length).toBeLessThanOrEqual(4000);
  });
});