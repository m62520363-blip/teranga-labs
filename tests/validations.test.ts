import { describe, expect, it } from "vitest";
import {
  briefSchema,
  loginSchema,
  parseSkills,
  signupSchema,
} from "@/lib/validations";

const validBrief = {
  client_name: "Boutique Bazin HLM",
  client_whatsapp: "+221771234567",
  client_city: "Dakar",
  project_type: "vitrine",
  budget: 150000,
  description:
    "Je vends des bazins à HLM et je veux un site pour présenter mes articles et recevoir des commandes.",
};

describe("briefSchema", () => {
  it("accepte un brief valide", () => {
    const result = briefSchema.safeParse(validBrief);
    expect(result.success).toBe(true);
  });

  it("accepte le budget sous forme de chaîne (coerce)", () => {
    const result = briefSchema.safeParse({ ...validBrief, budget: "150000" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.budget).toBe(150000);
  });

  it("rejette un budget trop bas", () => {
    const result = briefSchema.safeParse({ ...validBrief, budget: 5000 });
    expect(result.success).toBe(false);
  });

  it("rejette une région inconnue", () => {
    const result = briefSchema.safeParse({ ...validBrief, client_city: "Paris" });
    expect(result.success).toBe(false);
  });

  it("rejette un type de projet inconnu", () => {
    const result = briefSchema.safeParse({
      ...validBrief,
      project_type: "mobile",
    });
    expect(result.success).toBe(false);
  });

  it("rejette une description trop courte", () => {
    const result = briefSchema.safeParse({ ...validBrief, description: "trop court" });
    expect(result.success).toBe(false);
  });

  it("rejette un numéro WhatsApp invalide", () => {
    const result = briefSchema.safeParse({ ...validBrief, client_whatsapp: "abc" });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepte un email et mot de passe valides", () => {
    expect(
      loginSchema.safeParse({ email: "dev@teranga.sn", password: "secret123" })
        .success
    ).toBe(true);
  });

  it("rejette un email invalide", () => {
    expect(loginSchema.safeParse({ email: "pasunemail", password: "x" }).success).toBe(
      false
    );
  });
});

describe("signupSchema", () => {
  const valid = {
    full_name: "Awa Ndiaye",
    email: "awa@teranga.sn",
    password: "Motdepasse1",
    whatsapp: "+221771234567",
    skills: "Next.js, Supabase",
  };

  it("accepte une inscription valide", () => {
    expect(signupSchema.safeParse(valid).success).toBe(true);
  });

  it("rejette un mot de passe sans chiffre", () => {
    expect(
      signupSchema.safeParse({ ...valid, password: "MotdepasseMotdepasse" }).success
    ).toBe(false);
  });
});

describe("parseSkills", () => {
  it("nettoie et sépare les compétences", () => {
    expect(parseSkills(" Next.js ,  Supabase ,, UI/UX ")).toEqual([
      "Next.js",
      "Supabase",
      "UI/UX",
    ]);
  });

  it("retourne un tableau vide pour une chaîne vide", () => {
    expect(parseSkills("")).toEqual([]);
    expect(parseSkills("   ")).toEqual([]);
  });

  it("limite à 12 compétences", () => {
    const raw = Array.from({ length: 20 }, (_, i) => `skill${i}`).join(", ");
    expect(parseSkills(raw)).toHaveLength(12);
  });
});