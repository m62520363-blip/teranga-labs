import { describe, expect, it } from "vitest";
import {
  briefSchema,
  developerApplicationSchema,
  developerIdentitySchema,
  loginSchema,
  parseSkills,
  phoneOtpSchema,
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
      loginSchema.safeParse({ email: "dev@devmarket.sn", password: "secret123" })
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
    email: "awa@devmarket.sn",
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

describe("developerIdentitySchema", () => {
  const valid = {
    first_name: "Awa",
    last_name: "Diop",
    username: "awa-diop",
    phone: "+221771234567",
    whatsapp: "+221771234567",
    address: "Scat Urbam",
    country: "Sénégal",
    city: "Dakar",
  };

  it("accepte une identité valide", () => {
    const result = developerIdentitySchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.username).toBe("awa-diop");
  });

  it("rejette un pseudo avec majuscules ou espaces", () => {
    expect(developerIdentitySchema.safeParse({ ...valid, username: "Awa Diop" }).success).toBe(
      false
    );
    expect(developerIdentitySchema.safeParse({ ...valid, username: "awa_diop" }).success).toBe(
      false
    );
  });

  it("accepte un pseudo à trait d’union", () => {
    expect(
      developerIdentitySchema.safeParse({ ...valid, username: "awa-ndiaye-2024" }).success
    ).toBe(true);
  });

  it("rejette un prénom trop court", () => {
    expect(developerIdentitySchema.safeParse({ ...valid, first_name: "A" }).success).toBe(
      false
    );
  });

  it("accepte une ville hors périmètre (inscription monde) et borne la longueur", () => {
    // Le profil développeur s'inscrit dans le monde entier : la région n'est
    // plus restreinte au périmètre 9 pays (lib/world-countries.ts).
    expect(developerIdentitySchema.safeParse({ ...valid, city: "Paris" }).success).toBe(true);
    expect(developerIdentitySchema.safeParse({ ...valid, city: "Austin" }).success).toBe(true);
    expect(developerIdentitySchema.safeParse({ ...valid, city: "x" }).success).toBe(false);
    expect(
      developerIdentitySchema.safeParse({ ...valid, city: "a".repeat(61) }).success
    ).toBe(false);
  });
});

describe("developerApplicationSchema", () => {
  const valid = {
    professional_title: "Développeur full-stack",
    main_specialty: "Développeur web",
    experience_level: "intermediaire",
    experience_years: 3,
    projects_estimate: 12,
    availability: "available_now",
    rate_min_fcfa: 100000,
    rate_max_fcfa: 300000,
    bio: "Je conçois des sites et applications web depuis 3 ans.",
    avatar_url: "",
    services: ["Site vitrine"],
    skills: ["Next.js"],
    projects: [
      {
        name: "Boutique Bazin",
        description: "",
        project_type: "vitrine",
        technologies: ["Next.js", "Supabase"],
        url: "https://boutique.example",
        screenshots: [],
      },
    ],
    documents: [],
    links: [{ kind: "github", label: "Mon GitHub", url: "https://github.com/awa" }],
    terms_accepted: true,
  };

  it("accepte une candidature valide", () => {
    expect(developerApplicationSchema.safeParse(valid).success).toBe(true);
  });

  it("rejette sans service", () => {
    expect(
      developerApplicationSchema.safeParse({ ...valid, services: [] }).success
    ).toBe(false);
  });

  it("rejette sans compétence", () => {
    expect(
      developerApplicationSchema.safeParse({ ...valid, skills: [] }).success
    ).toBe(false);
  });

  it("rejette un tarif maximum inférieur au minimum", () => {
    expect(
      developerApplicationSchema.safeParse({
        ...valid,
        rate_min_fcfa: 300000,
        rate_max_fcfa: 100000,
      }).success
    ).toBe(false);
  });

  it("rejette un niveau d’expérience inconnu", () => {
    expect(
      developerApplicationSchema.safeParse({ ...valid, experience_level: "genie" }).success
    ).toBe(false);
  });

  it("rejette le refus des conditions", () => {
    expect(
      developerApplicationSchema.safeParse({ ...valid, terms_accepted: false }).success
    ).toBe(false);
  });

  it("rejette un lien URL invalide", () => {
    expect(
      developerApplicationSchema.safeParse({
        ...valid,
        links: [{ kind: "github", label: "", url: "pas-une-url" }],
      }).success
    ).toBe(false);
  });
});
describe("phoneOtpSchema", () => {
  it("accepte un E.164 senegalais", () => {
    expect(phoneOtpSchema.safeParse({ phone: "+221771234567" }).success).toBe(true);
  });

  it("normalise les espaces, tirets et parenthetes", () => {
    const parsed = phoneOtpSchema.safeParse({ phone: "+221 77 123-45 (67)" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.phone).toBe("+221771234567");
  });

  it("accepte un indicatif pays different de 221", () => {
    expect(phoneOtpSchema.safeParse({ phone: "+33612345678" }).success).toBe(true);
  });

  it("refuse un numero sans indicatif pays", () => {
    expect(phoneOtpSchema.safeParse({ phone: "771234567" }).success).toBe(false);
  });

  it("refuse un numero trop court", () => {
    expect(phoneOtpSchema.safeParse({ phone: "+22177" }).success).toBe(false);
  });

  it("refuse un champ vide", () => {
    expect(phoneOtpSchema.safeParse({ phone: "" }).success).toBe(false);
  });

it("refuse un indicatif pays qui commence par zero", () => {
    expect(phoneOtpSchema.safeParse({ phone: "+0771234567" }).success).toBe(false);
  });

  it("refuse un numero trop long", () => {
    expect(phoneOtpSchema.safeParse({ phone: "+221771234567890123" }).success).toBe(false);
  });

  it("refuse une lettre meleee au numero", () => {
    expect(phoneOtpSchema.safeParse({ phone: "+22177abc4567" }).success).toBe(false);
  });
});
