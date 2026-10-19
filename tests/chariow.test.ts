import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "crypto";
import {
  amountMatchesSale,
  ChariowApiError,
  createChariowCheckout,
  getChariowSale,
  getPulseReference,
  isChariowApiError,
  isSaleCompleted,
  parseCustomerPhone,
  splitCustomerName,
  verifyPulseSignature,
  type ChariowSale,
} from "@/lib/payments/chariow";
import {
  getVerificationProductSlug,
  isChariowConfigured,
  isPulseConfigured,
  getTokenProductSlug,
} from "@/lib/payments/chariow-config";

const PULSE_SECRET = "whsec_test_secret";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function stubChariowEnv() {
  vi.stubEnv("CHARIOW_API_KEY", "sk_test_abc");
  vi.stubEnv("CHARIOW_PULSE_SECRET", PULSE_SECRET);
  vi.stubEnv("CHARIOW_BASE_URL", "https://api.chariow.com/v1");
}

describe("configuration Chariow", () => {
  it("n'est configuré qu'avec une clé API serveur", () => {
    vi.stubEnv("CHARIOW_API_KEY", "");
    expect(isChariowConfigured()).toBe(false);
    vi.stubEnv("CHARIOW_API_KEY", "sk_test_abc");
    expect(isChariowConfigured()).toBe(true);
  });

  it("pulse configuré seulement avec le secret de signature", () => {
    vi.stubEnv("CHARIOW_PULSE_SECRET", "");
    expect(isPulseConfigured()).toBe(false);
    vi.stubEnv("CHARIOW_PULSE_SECRET", PULSE_SECRET);
    expect(isPulseConfigured()).toBe(true);
  });

  it("slug de pack = id du pack ; slug vérification surchargeable", () => {
    expect(getTokenProductSlug("pro")).toBe("pro");
    expect(getTokenProductSlug("agence")).toBe("agence");
    vi.stubEnv("CHARIOW_VERIFICATION_PRODUCT", "mon-slug");
    expect(getVerificationProductSlug()).toBe("mon-slug");
    vi.stubEnv("CHARIOW_VERIFICATION_PRODUCT", "");
    expect(getVerificationProductSlug()).toBe("verification-profil");
  });
});

describe("parseCustomerPhone", () => {
  it("découpe un numéro du périmètre (SN)", () => {
    expect(parseCustomerPhone("+221771234567")).toEqual({
      number: "771234567",
      country_code: "SN",
    });
  });

  it("gère les indicateurs à 2 chiffres (France) et à 1 chiffre (US)", () => {
    expect(parseCustomerPhone("+33612345678")).toEqual({
      number: "612345678",
      country_code: "FR",
    });
    expect(parseCustomerPhone("+14155551234")).toEqual({
      number: "4155551234",
      country_code: "US",
    });
  });

  it("accepte les séparateurs de saisie", () => {
    expect(parseCustomerPhone("+221 77 12 34 56 7")).toEqual({
      number: "771234567",
      country_code: "SN",
    });
  });

  it("refuse l'absence de +, le vide, les numéros courts et les indicateurs inconnus", () => {
    expect(parseCustomerPhone("771234567")).toBeNull();
    expect(parseCustomerPhone("")).toBeNull();
    expect(parseCustomerPhone(null)).toBeNull();
    expect(parseCustomerPhone("+22177")).toBeNull();
    expect(parseCustomerPhone("+99912345678")).toBeNull();
    expect(parseCustomerPhone("pas un numéro")).toBeNull();
  });
});

describe("splitCustomerName", () => {
  it("sépare prénom et nom", () => {
    expect(splitCustomerName("Aminata Diop")).toEqual({
      first_name: "Aminata",
      last_name: "Diop",
    });
  });

  it("gère un seul mot et une valeur absente", () => {
    expect(splitCustomerName("Aminata")).toEqual({
      first_name: "Aminata",
      last_name: "Aminata",
    });
    expect(splitCustomerName(null)).toEqual({
      first_name: "Client",
      last_name: "Client",
    });
  });

  it("trunc à 50 caractères (limite API)", () => {
    const long = "A".repeat(60) + " " + "B".repeat(60);
    const { first_name, last_name } = splitCustomerName(long);
    expect(first_name).toHaveLength(50);
    expect(last_name).toHaveLength(50);
  });
});

describe("verifyPulseSignature", () => {
  const body = JSON.stringify({
    event: "successful.sale",
    sale: { id: "sal_1", custom_metadata: { reference: "ref" } },
  });

  function sign(raw: string, secret: string) {
    return "sha256=" + createHmac("sha256", secret).update(raw, "utf8").digest("hex");
  }

  it("accepte une signature valide calculée sur le corps brut", () => {
    stubChariowEnv();
    expect(verifyPulseSignature(body, sign(body, PULSE_SECRET))).toBe(true);
  });

  it("rejette un corps modifié même avec une signature préalablement valide", () => {
    stubChariowEnv();
    const tampered = body.replace("sal_1", "sal_2");
    expect(verifyPulseSignature(tampered, sign(body, PULSE_SECRET))).toBe(false);
  });

  it("rejette un mauvais secret, un header absent ou un schéma inconnu", () => {
    stubChariowEnv();
    expect(verifyPulseSignature(body, sign(body, "whsec_wrong"))).toBe(false);
    expect(verifyPulseSignature(body, null)).toBe(false);
    expect(verifyPulseSignature(body, "")).toBe(false);
    expect(verifyPulseSignature(body, "v1=abcd")).toBe(false);
  });

  it("rejette sans secret configuré", () => {
    vi.stubEnv("CHARIOW_API_KEY", "sk_test_abc");
    vi.stubEnv("CHARIOW_PULSE_SECRET", "");
    expect(verifyPulseSignature(body, sign(body, PULSE_SECRET))).toBe(false);
  });

  it("n'échoue jamais sur des longueurs différentes (timingSafeEqual)", () => {
    stubChariowEnv();
    expect(verifyPulseSignature(body, "sha256=abc")).toBe(false);
  });
});

describe("isSaleCompleted / amountMatchesSale", () => {
  const sale = (over: Partial<ChariowSale> = {}): ChariowSale => ({
    id: "sal_1",
    status: "completed",
    amount: { value: 20000, currency: "XOF" },
    ...over,
  });

  it("completed et settled créditent, les autres non", () => {
    expect(isSaleCompleted(sale())).toBe(true);
    expect(isSaleCompleted(sale({ status: "settled" }))).toBe(true);
    expect(isSaleCompleted(sale({ status: "awaiting_payment" }))).toBe(false);
    expect(isSaleCompleted(sale({ status: "failed" }))).toBe(false);
    expect(isSaleCompleted(sale({ status: "abandoned" }))).toBe(false);
  });

  it("montant strictement égal en XOF uniquement", () => {
    expect(amountMatchesSale(sale(), 20000)).toBe(true);
    expect(amountMatchesSale(sale(), 19999)).toBe(false);
    expect(amountMatchesSale(sale(), 0)).toBe(false);
    expect(amountMatchesSale(sale({ amount: { value: 20000, currency: "EUR" } }), 20000)).toBe(false);
    expect(amountMatchesSale(sale({ amount: null }), 20000)).toBe(false);
  });
});

describe("getPulseReference", () => {
  it("lit la référence et le type posés à l'initiation", () => {
    expect(
      getPulseReference({ custom_metadata: { reference: "uuid-1", kind: "token" } })
    ).toEqual({ reference: "uuid-1", kind: "token" });
    expect(
      getPulseReference({ custom_metadata: { reference: "uuid-2", kind: "verification" } })
    ).toEqual({ reference: "uuid-2", kind: "verification" });
  });

  it("retombe sur token sans métadonnées exploitables", () => {
    expect(getPulseReference(null)).toEqual({ reference: null, kind: "token" });
    expect(getPulseReference({ custom_metadata: null })).toEqual({
      reference: null,
      kind: "token",
    });
  });
});

describe("createChariowCheckout", () => {
  it("construit le corps attendu et renvoie l'URL de paiement", async () => {
    stubChariowEnv();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          step: "payment",
          purchase: { id: "sal_123", status: "awaiting_payment" },
          payment: { checkout_url: "https://pay.example.com/checkout/1" },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createChariowCheckout({
      productSlug: "pro",
      email: "dev@example.com",
      fullName: "Aminata Diop",
      phone: "+221771234567",
      redirectUrl: "https://site.example.com/tokens?intent=abc",
      metadata: { reference: "abc", kind: "token", package_id: "pro" },
      customerIp: "203.0.113.42",
    });

    expect(result).toEqual({
      step: "payment",
      saleId: "sal_123",
      checkoutUrl: "https://pay.example.com/checkout/1",
      message: null,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.chariow.com/v1/checkout");
    expect(init.headers.Authorization).toBe("Bearer sk_test_abc");
    const body = JSON.parse(init.body);
    expect(body.product_id).toBe("pro");
    expect(body.email).toBe("dev@example.com");
    expect(body.first_name).toBe("Aminata");
    expect(body.last_name).toBe("Diop");
    expect(body.phone).toEqual({ number: "771234567", country_code: "SN" });
    expect(body.payment_currency).toBe("XOF");
    expect(body.redirect_url).toBe("https://site.example.com/tokens?intent=abc");
    expect(body.custom_metadata).toEqual({
      reference: "abc",
      kind: "token",
      package_id: "pro",
    });
    expect(body.customer_ip).toBe("203.0.113.42");
  });

  it("refuse un numéro invalide avant tout appel réseau", async () => {
    stubChariowEnv();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createChariowCheckout({
        productSlug: "pro",
        email: "dev@example.com",
        fullName: "Aminata",
        phone: "771234567",
        redirectUrl: "https://site.example.com/tokens",
        metadata: { reference: "abc", kind: "token" },
      })
    ).rejects.toThrow(ChariowApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("remonte les erreurs 422 de validation de l'API", async () => {
    stubChariowEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({
          message: "The phone.number field is required.",
          errors: { "phone.number": ["The phone.number field is required."] },
        }),
      })
    );

    const err = await createChariowCheckout({
      productSlug: "pro",
      email: "dev@example.com",
      fullName: "Aminata",
      phone: "+221771234567",
      redirectUrl: "https://site.example.com/tokens",
      metadata: { reference: "abc", kind: "token" },
    }).catch((e) => e);

    expect(isChariowApiError(err)).toBe(true);
    expect(err).toMatchObject({ status: 422, code: "chariow_field_phone.number" });
  });

  it("signale un checkout déjà acheté sans URL", async () => {
    stubChariowEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: { step: "already_purchased", purchase: null, payment: null },
        }),
      })
    );

    const result = await createChariowCheckout({
      productSlug: "pro",
      email: "dev@example.com",
      fullName: "Aminata",
      phone: "+221771234567",
      redirectUrl: "https://site.example.com/tokens",
      metadata: { reference: "abc", kind: "token" },
    });
    expect(result.step).toBe("already_purchased");
    expect(result.checkoutUrl).toBeNull();
  });

  it("exige vente + URL quand l'étape est payment", async () => {
    stubChariowEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { step: "payment", purchase: null, payment: null } }),
      })
    );

    await expect(
      createChariowCheckout({
        productSlug: "pro",
        email: "dev@example.com",
        fullName: "Aminata",
        phone: "+221771234567",
        redirectUrl: "https://site.example.com/tokens",
        metadata: { reference: "abc", kind: "token" },
      })
    ).rejects.toMatchObject({ code: "chariow_missing_redirect" });
  });
});

describe("getChariowSale", () => {
  it("dénoue la forme { data: sale } de GET /v1/sales/{id}", async () => {
    stubChariowEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: { id: "sal_1", status: "completed", amount: { value: 6500, currency: "XOF" } },
        }),
      })
    );

    const sale = await getChariowSale("sal_1");
    expect(sale.id).toBe("sal_1");
    expect(sale.status).toBe("completed");
  });

  it("accepte une vente à la racine", async () => {
    stubChariowEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: "sal_2", status: "completed" }),
      })
    );
    const sale = await getChariowSale("sal_2");
    expect(sale.id).toBe("sal_2");
  });

  it("transforme un 404 en ChariowApiError (sale_not_found)", async () => {
    stubChariowEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ message: "Sale not found" }),
      })
    );

    const err = await getChariowSale("sal_x").catch((e) => e);
    expect(isChariowApiError(err)).toBe(true);
    expect(err.status).toBe(404);
  });
});
