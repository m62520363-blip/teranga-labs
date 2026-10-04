import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "crypto";
import {
  amountMatches,
  confirmPaydunyaCheckout,
  createPaydunyaCheckout,
  isPaymentCompleted,
  parseIpnFormData,
  verifyIpnHash,
  PaydunyaApiError,
  type PaydunyaIpn,
} from "@/lib/payments/paydunya";
import {
  getPaydunyaConfig,
  isPaydunyaConfigured,
} from "@/lib/payments/paydunya-config";

const MASTER = "master-key-de-test-0123456789";

/** Reproduit le format IPN réel : clé racine `data`, JSON sérialisé. */
function ipnBody(overrides: Partial<PaydunyaIpn> = {}): string {
  const payload: PaydunyaIpn = {
    response_code: "00",
    status: "completed",
    hash: createHash("sha512").update(MASTER).digest("hex"),
    invoice: { token: "test_abc", total_amount: "5000" },
    custom_data: { intent_id: "intent-uuid-1" },
    ...overrides,
  };
  return JSON.stringify(payload);
}

beforeEach(() => {
  vi.stubEnv("PAYDUNYA_MODE", "test");
  vi.stubEnv("PAYDUNYA_TEST_MASTER_KEY", MASTER);
  vi.stubEnv("PAYDUNYA_TEST_PRIVATE_KEY", "test_private_x");
  vi.stubEnv("PAYDUNYA_TEST_TOKEN", "tokenx");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("verifyIpnHash", () => {
  it("accepte le SHA-512 de la MasterKey", () => {
    expect(verifyIpnHash(createHash("sha512").update(MASTER).digest("hex"))).toBe(true);
  });

  it("refuse un hash qui ne correspond pas", () => {
    expect(verifyIpnHash(createHash("sha512").update("autre").digest("hex"))).toBe(false);
    expect(verifyIpnHash("deadbeef")).toBe(false);
  });

  it("tolere la casse et les espaces", () => {
    const hash = createHash("sha512").update(MASTER).digest("hex");
    expect(verifyIpnHash(hash.toUpperCase())).toBe(true);
    expect(verifyIpnHash(`  ${hash}  `)).toBe(true);
  });

  it("refuse une valeur absente ou non string", () => {
    expect(verifyIpnHash(undefined)).toBe(false);
    expect(verifyIpnHash(null)).toBe(false);
    expect(verifyIpnHash("")).toBe(false);
    expect(verifyIpnHash(12345)).toBe(false);
  });

  it("compare sur la MasterKey de l'environnement actif", () => {
    vi.stubEnv("PAYDUNYA_MODE", "live");
    vi.stubEnv("PAYDUNYA_MASTER_KEY", "master-live-autre");
    // Hash produit avec la clé test : doit être refusé en mode live.
    expect(verifyIpnHash(createHash("sha512").update(MASTER).digest("hex"))).toBe(false);
  });
});

describe("parseIpnFormData", () => {
  it("décode la clé racine data", () => {
    const ipn = parseIpnFormData({ data: ipnBody() });
    expect(ipn?.status).toBe("completed");
    expect(ipn?.invoice?.total_amount).toBe("5000");
    expect(ipn?.custom_data?.intent_id).toBe("intent-uuid-1");
  });

  it("accepte un tableau de valeurs pour data", () => {
    const ipn = parseIpnFormData({ data: [ipnBody()] });
    expect(ipn?.status).toBe("completed");
  });

  it("renvoie null si data est absent ou illisible", () => {
    expect(parseIpnFormData({})).toBeNull();
    expect(parseIpnFormData({ data: "pas-du-json" })).toBeNull();
    expect(parseIpnFormData({ data: "[1,2,3]" })).toBeNull();
  });
});

describe("isPaymentCompleted", () => {
  it("ne traite que completed", () => {
    expect(isPaymentCompleted({ status: "completed" })).toBe(true);
    expect(isPaymentCompleted({ status: "pending" })).toBe(false);
    expect(isPaymentCompleted({ status: "cancelled" })).toBe(false);
    expect(isPaymentCompleted({ status: "failed" })).toBe(false);
    expect(isPaymentCompleted({})).toBe(false);
  });
});

describe("amountMatches", () => {
  it("exige une égalité stricte", () => {
    expect(amountMatches("5000", 5000)).toBe(true);
    expect(amountMatches(5000, 5000)).toBe(true);
    expect(amountMatches(" 5000 ", 5000)).toBe(true);
  });

  it("refuse un montant différent, même proche", () => {
    expect(amountMatches("1", 5000)).toBe(false);
    expect(amountMatches("5001", 5000)).toBe(false);
    expect(amountMatches("50000", 5000)).toBe(false);
  });

  it("refuse une valeur non numérique ou absente", () => {
    expect(amountMatches(undefined, 5000)).toBe(false);
    expect(amountMatches("", 5000)).toBe(false);
    expect(amountMatches("abc", 5000)).toBe(false);
  });
});

describe("getPaydunyaConfig", () => {
  it("utilise le segment sandbox-api en test", () => {
    const config = getPaydunyaConfig();
    expect(config.mode).toBe("test");
    expect(config.checkoutCreateUrl).toContain("/sandbox-api/");
  });

  it("utilise le segment api en live, sans sandbox", () => {
    vi.stubEnv("PAYDUNYA_MODE", "live");
    const config = getPaydunyaConfig();
    expect(config.mode).toBe("live");
    expect(config.checkoutCreateUrl).not.toContain("sandbox");
    expect(config.checkoutCreateUrl).toContain("/api/v1/");
  });

  it("ne mélange pas test et live en mode live", () => {
    vi.stubEnv("PAYDUNYA_MODE", "live");
    // Seul le couple live est défini : aucune valeur test ne doitFuiter.
    vi.stubEnv("PAYDUNYA_MASTER_KEY", "master-live");
    vi.stubEnv("PAYDUNYA_PRIVATE_KEY", "live_private");
    vi.stubEnv("PAYDUNYA_TOKEN", "token-live");
    const config = getPaydunyaConfig();
    expect(config.privateKey).toBe("live_private");
    expect(config.token).toBe("token-live");
  });
});

describe("isPaydunyaConfigured", () => {
  it("vrai quand les trois secrets sont présents", () => {
    expect(isPaydunyaConfigured()).toBe(true);
  });

  it("faux si un secret manque", () => {
    vi.stubEnv("PAYDUNYA_TEST_TOKEN", "");
    expect(isPaydunyaConfigured()).toBe(false);
  });

  it("faux si rien n'est configuré", () => {
    vi.unstubAllEnvs();
    vi.stubEnv("PAYDUNYA_MODE", "test");
    expect(isPaydunyaConfigured()).toBe(false);
  });
});

/**
 * Le corps envoyé a PayDunya conditionne l'acceptation de la facture ET ce
 * que l'acheteur voit sur leur page. Il etait entierement non teste : une
 * cle de `store` manquante ou un `customer` mal forme se manifestait
 * uniquement en production, sous forme d'une page de paiement vide ou d'une
 * facture refusee.
 */
describe("createPaydunyaCheckout", () => {
  /** Capture le corps JSON envoye a l'API. */
  async function captureBody(
    params: Partial<Parameters<typeof createPaydunyaCheckout>[0]> = {}
  ): Promise<Record<string, never>> {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        response_code: "00",
        response_text: "https://app.paydunya.com/sandbox-checkout/testabc",
        token: "testabc",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await createPaydunyaCheckout({
      amountFcfa: 20000,
      description: "Pack Starter",
      itemName: "Starter",
      itemQuantity: 8,
      customData: { intent_id: "intent-uuid-1" },
      ...params,
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    return JSON.parse(String(init.body)) as Record<string, never>;
  }

  it("envoie store.name, exige par PayDunya", async () => {
    const body = await captureBody();
    expect((body.store as { name: string }).name).toBe("TERANGA LABS");
  });

  it("ajoute store.logo_url depuis l'origine publique", async () => {
    const body = await captureBody({ siteUrl: "https://teranga-labs.vercel.app" });
    expect((body.store as { logo_url?: string }).logo_url).toBe(
      "https://teranga-labs.vercel.app/logo.png"
    );
  });

  it("normalise une origine avec slash final", async () => {
    const body = await captureBody({ siteUrl: "https://teranga-labs.vercel.app/" });
    expect((body.store as { logo_url?: string }).logo_url).toBe(
      "https://teranga-labs.vercel.app/logo.png"
    );
  });

  it("omet logo_url si l'origine est inconnue", async () => {
    const body = await captureBody();
    expect((body.store as { logo_url?: string }).logo_url).toBeUndefined();
  });

  it("renvoie le noeud customer pour pre-remplir la page", async () => {
    const body = await captureBody({
      customer: { name: "Awa Diop", email: "awa@example.sn", phone: "771234567" },
    });
    expect((body.invoice as { customer?: unknown }).customer).toEqual({
      name: "Awa Diop",
      email: "awa@example.sn",
      phone: "771234567",
    });
  });

  it("omet customer plutot que d'envoyer un objet vide", async () => {
    const body = await captureBody({ customer: {} });
    expect((body.invoice as { customer?: unknown }).customer).toBeUndefined();
  });

  it("exige unit_price et total_price en chaine", async () => {
    const body = await captureBody();
    const item = (body.invoice as { items: { item_0: Record<string, unknown> } })
      .items.item_0;
    expect(item.unit_price).toBe("20000");
    expect(item.total_price).toBe("20000");
  });

  it("transporte l'intention via custom_data", async () => {
    const body = await captureBody();
    expect((body.invoice as { custom_data: unknown }).custom_data).toEqual({
      intent_id: "intent-uuid-1",
    });
  });

  it("renvoie le token et l'URL de redirection", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          response_code: "00",
          response_text: "https://app.paydunya.com/sandbox-checkout/testabc",
          token: "testabc",
        }),
      })
    );
    const result = await createPaydunyaCheckout({
      amountFcfa: 20000,
      description: "Pack Starter",
      itemName: "Starter",
      itemQuantity: 8,
      customData: { intent_id: "intent-uuid-1" },
    });
    expect(result).toEqual({
      token: "testabc",
      redirectUrl: "https://app.paydunya.com/sandbox-checkout/testabc",
    });
  });
});

/**
 * La re-verification serveur est ce qui rend le credit fiable : le hash de
 * l'IPN ne couvrant pas le contenu, seul l'etat redemande a PayDunya fait foi.
 */
describe("confirmPaydunyaCheckout", () => {
  function mockConfirm(payload: unknown, ok = true) {
    const fetchMock = vi.fn().mockResolvedValue({
      ok,
      status: ok ? 200 : 401,
      json: async () => payload,
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

it("interroge checkout-invoice/confirm avec le jeton encode", async () => {
    const fetchMock = mockConfirm({
      response_code: "00",
      response_text: "ok",
      status: "completed",
      invoice: { total_amount: "20000" },
    });
    await confirmPaydunyaCheckout("test_VPGPZNnHOC/../x");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/checkout-invoice/confirm/");
    // Les separateurs de chemin sont encodes : un jeton contenant `/` ou
    // `..` ne peut pas sortir du endpoint. Les points restent litteraux,
    // ce qui est sans consequence une fois `/` encode.
    expect(url).not.toContain("/../");
    expect(url).toContain("%2F");
    expect(init.method).toBe("GET");
  });

  it("renvoie le statut et le montant reellement confirmes", async () => {
    mockConfirm({
      response_code: "00",
      response_text: "ok",
      status: "completed",
      invoice: { total_amount: "20000" },
    });
    const result = await confirmPaydunyaCheckout("test_abc");
    expect(result.status).toBe("completed");
    expect(result.totalAmount).toBe(20000);
    expect(result.token).toBe("test_abc");
  });

  it("accepte un statut imbrique sous invoice", async () => {
    mockConfirm({
      response_code: "00",
      response_text: "ok",
      invoice: { status: "completed", total_amount: 20000 },
    });
    expect((await confirmPaydunyaCheckout("test_abc")).status).toBe("completed");
  });

  it("normalise la casse du statut", async () => {
    mockConfirm({
      response_code: "00",
      response_text: "ok",
      status: "COMPLETED",
      invoice: { total_amount: "20000" },
    });
    expect((await confirmPaydunyaCheckout("test_abc")).status).toBe("completed");
  });

  it("refuse un statut inconnu plutot que de le traiter comme paye", async () => {
    mockConfirm({
      response_code: "00",
      response_text: "ok",
      status: "refunded",
      invoice: { total_amount: "20000" },
    });
    await expect(confirmPaydunyaCheckout("test_abc")).rejects.toBeInstanceOf(
      PaydunyaApiError
    );
  });

  it("refuse une reponse sans statut", async () => {
    mockConfirm({ response_code: "00", response_text: "ok" });
    await expect(confirmPaydunyaCheckout("test_abc")).rejects.toBeInstanceOf(
      PaydunyaApiError
    );
  });

  it("leve sur un code applicatif en erreur malgre un HTTP 200", async () => {
    mockConfirm({ response_code: "01", response_text: "Clef invalide" });
    await expect(confirmPaydunyaCheckout("test_abc")).rejects.toBeInstanceOf(
      PaydunyaApiError
    );
  });

  it("leve sur un refus HTTP", async () => {
    mockConfirm({ response_code: "00", response_text: "ok" }, false);
    await expect(confirmPaydunyaCheckout("test_abc")).rejects.toBeInstanceOf(
      PaydunyaApiError
    );
  });

  it("renvoie totalAmount undefined si PayDunya ne le precise pas", async () => {
    mockConfirm({ response_code: "00", response_text: "ok", status: "completed" });
    expect((await confirmPaydunyaCheckout("test_abc")).totalAmount).toBeUndefined();
  });

  it("utilise le segment sandbox en mode test", async () => {
    const fetchMock = mockConfirm({
      response_code: "00",
      response_text: "ok",
      status: "completed",
      invoice: { total_amount: "20000" },
    });
    await confirmPaydunyaCheckout("test_abc");
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("/sandbox-api/v1/checkout-invoice/confirm/");
  });

  it("utilise le segment api, sans sandbox, en mode live", async () => {
    vi.stubEnv("PAYDUNYA_MODE", "live");
    vi.stubEnv("PAYDUNYA_MASTER_KEY", MASTER);
    vi.stubEnv("PAYDUNYA_PRIVATE_KEY", "private_live");
    vi.stubEnv("PAYDUNYA_TOKEN", "token-live");
    const fetchMock = mockConfirm({
      response_code: "00",
      response_text: "ok",
      status: "completed",
      invoice: { total_amount: "20000" },
    });
    await confirmPaydunyaCheckout("test_abc");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/checkout-invoice/confirm/");
    expect(url).not.toContain("sandbox");
    expect((init.headers as Record<string, string>)["PAYDUNYA-PRIVATE-KEY"]).toBe(
      "private_live"
    );
  });
});
