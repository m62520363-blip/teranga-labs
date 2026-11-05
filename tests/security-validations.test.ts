import { describe, expect, it } from "vitest";
import {
  otpRequestSchema,
  otpVerifySchema,
  paymentCheckoutSchema,
  paymentStatusSchema,
  verificationCheckoutSchema,
} from "@/lib/validations";
import { COUNTRIES, SCOPE_COUNTRY_CODES } from "@/lib/countries";

describe("paymentCheckoutSchema", () => {
  it("accepte un package minimal", () => {
    const r = paymentCheckoutSchema.safeParse({ packageId: "pro" });
    expect(r.success).toBe(true);
  });

  it("rejette un packageId vide", () => {
    const r = paymentCheckoutSchema.safeParse({ packageId: " " });
    expect(r.success).toBe(false);
  });

  it("rejette les champs inconnus (strict)", () => {
    const r = paymentCheckoutSchema.safeParse({ packageId: "pro", hack: true });
    expect(r.success).toBe(false);
  });

  it("rejette un prestataire résiduel (strict, prestataire unique Chariow)", () => {
    expect(paymentCheckoutSchema.safeParse({ packageId: "pro", provider: "wave" }).success).toBe(false);
    expect(paymentCheckoutSchema.safeParse({ packageId: "pro", provider: "chariow" }).success).toBe(false);
  });
});

describe("paymentStatusSchema", () => {
  it("accepte un uuid", () => {
    const r = paymentStatusSchema.safeParse({
      intent: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(r.success).toBe(true);
  });

  it("rejette un identifiant non-uuid", () => {
    const r = paymentStatusSchema.safeParse({ intent: "pro" });
    expect(r.success).toBe(false);
  });
});

describe("verificationCheckoutSchema", () => {
  it("accepte un body vide (méthode optionnelle)", () => {
    expect(verificationCheckoutSchema.safeParse({}).success).toBe(true);
  });

  it("accepte chariow (paiement en ligne) et max_it", () => {
    expect(verificationCheckoutSchema.safeParse({ method: "chariow" }).success).toBe(true);
    expect(verificationCheckoutSchema.safeParse({ method: "max_it" }).success).toBe(true);
  });

  it("rejette une méthode inconnue et un champ inconnu (strict)", () => {
    expect(verificationCheckoutSchema.safeParse({ method: "wave" }).success).toBe(false);
    expect(verificationCheckoutSchema.safeParse({ method: "chariow", x: 1 }).success).toBe(false);
  });
});

describe("otpRequestSchema", () => {
  it("accepte une demande codes whatsapp avec cible", () => {
    const r = otpRequestSchema.safeParse({ channel: "whatsapp", target: "+221771234567" });
    expect(r.success).toBe(true);
    expect(r.data?.purpose).toBe("verification");
  });

  it("rejette un canal inconnu", () => {
    expect(otpRequestSchema.safeParse({ channel: "fax" }).success).toBe(false);
  });
});

describe("otpVerifySchema", () => {
  it("accepte un code à 6 chiffres", () => {
    const r = otpVerifySchema.safeParse({ channel: "sms", target: "+221771234567", code: "123456" });
    expect(r.success).toBe(true);
  });

  it("rejette un code non numérique ou mal formé", () => {
    expect(
      otpVerifySchema.safeParse({ channel: "sms", target: "+221771234567", code: "12ab56" }).success
    ).toBe(false);
    expect(
      otpVerifySchema.safeParse({ channel: "sms", target: "+221771234567", code: "123" }).success
    ).toBe(false);
  });
});

describe("périmètre pays (C1)", () => {
  it("couvre les 54 pays d'Afrique dont la Guinée-Bissau", () => {
    expect(COUNTRIES).toHaveLength(54);
    expect(SCOPE_COUNTRY_CODES).toContain("GW");
    expect(SCOPE_COUNTRY_CODES).toContain("GN");
  });

  it("fournit les régions de la Guinée-Bissau", () => {
    const gw = COUNTRIES.find((c) => c.code === "GW");
    expect(gw?.nameFr).toBe("Guinée-Bissau");
    expect(gw?.regions.length).toBeGreaterThanOrEqual(8);
    expect(gw?.currencyLabel).toBe("FCFA");
  });
});