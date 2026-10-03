import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "crypto";
import {
  amountMatches,
  isPaymentCompleted,
  parseIpnFormData,
  verifyIpnHash,
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
