import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPreferredProvider,
  getProviderByName,
  type CheckoutInput,
} from "@/lib/payments/provider";

const MASTER = "master-key-de-test-0123456789";

beforeEach(() => {
  vi.stubEnv("PAYDUNYA_MODE", "test");
  vi.stubEnv("PAYDUNYA_TEST_MASTER_KEY", MASTER);
  vi.stubEnv("PAYDUNYA_TEST_PRIVATE_KEY", "test_private_x");
  vi.stubEnv("PAYDUNYA_TEST_TOKEN", "tokenx");
  vi.stubEnv("WAVE_API_KEY", "wave_key_x");
  vi.stubEnv("WAVE_WEBHOOK_SECRET", "whsec_x");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const base: CheckoutInput = {
  amountFcfa: 5000,
  description: "Pack Starter - 5 Token(s) TERANGA LABS",
  reference: "intent-uuid-1",
  origin: "https://example.com",
  returnPath: "/tokens?intent=intent-uuid-1",
  cancelPath: "/tokens?intent=intent-uuid-1&cancelled=1",
};

describe("getPreferredProvider (résolution prestataire)", () => {
  it("auto → PayDunya prioritaire quand configuré", () => {
    expect(getPreferredProvider("auto")).toBe("paydunya");
  });

  it("wave → Wave uniquement même si PayDunya est configuré", () => {
    expect(getPreferredProvider("wave")).toBe("wave");
  });

  it("paydunya → repli Wave quand PayDunya n'est pas configuré", () => {
    vi.stubEnv("PAYDUNYA_TEST_MASTER_KEY", "");
    expect(getPreferredProvider("paydunya")).toBe("wave");
  });

  it("wave → null quand Wave n'est pas configuré", () => {
    vi.stubEnv("WAVE_API_KEY", "");
    vi.stubEnv("WAVE_WEBHOOK_SECRET", "");
    vi.stubEnv("PAYDUNYA_TEST_MASTER_KEY", "");
    expect(getPreferredProvider("wave")).toBeNull();
  });

  it("auto → null quand aucun prestataire n'est opérationnel", () => {
    vi.stubEnv("PAYDUNYA_TEST_MASTER_KEY", "");
    vi.stubEnv("WAVE_API_KEY", "");
    vi.stubEnv("WAVE_WEBHOOK_SECRET", "");
    expect(getPreferredProvider("auto")).toBeNull();
  });
});

describe("getProviderByName / createCheckout (contrat commun)", () => {
  it("wave : construit une session et renvoie { provider, launchUrl, sessionId }", async () => {
    vi.stubEnv("WAVE_API_KEY", "wave_key_x");
    vi.stubEnv("WAVE_WEBHOOK_SECRET", "whsec_x");
    vi.stubEnv("WAVE_BASE_URL", "https://sandbox.wave.com");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "wave_session_1",
          wave_launch_url: "https://pay.wave.com/session/wave_session_1",
        }),
      })
    );

    const impl = getProviderByName("wave");
    const result = await impl.createCheckout(base);

    expect(result.provider).toBe("wave");
    expect(result.launchUrl).toBe("https://pay.wave.com/session/wave_session_1");
    expect(result.sessionId).toBe("wave_session_1");

    const called = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(called[1].body);
    expect(body.amount).toBe("5000");
    expect(body.currency).toBe("XOF");
    expect(body.client_reference).toBe("intent-uuid-1");
  });

  it("paydunya : construit une facture PAR avec la référence en custom_data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response_text: "OK",
          response_code: "00",
          token: "paydunya_token_1",
          response_text_display: "",
        }),
      })
    );

    const impl = getProviderByName("paydunya");
    const result = await impl.createCheckout(base);

    expect(result.provider).toBe("paydunya");
    expect(result.sessionId).toBe("paydunya_token_1");

    const called = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(called[1].body);
    expect(body.invoice.custom_data.intent_id).toBe("intent-uuid-1");
    expect(body.invoice.total_amount).toBe(5000);
  });
});