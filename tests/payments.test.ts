import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";
import {
  verifyWaveSignature,
  amountMatches,
  isCheckoutCompleted,
} from "@/lib/payments/wave";

const SECRET = "whsec_test_secret_123";
const TOLERANCE = 300;

function sign(body: string, secret: string = SECRET, t: number = Math.floor(Date.now() / 1000)): string {
  const sig = createHmac("sha256", secret).update(body).digest("hex");
  return `t=${t},v1=${sig}`;
}

describe("verifyWaveSignature (scheme Wave-Signature)", () => {
  beforeEach(() => {
    process.env.WAVE_WEBHOOK_SECRET = SECRET;
    process.env.WAVE_WEBHOOK_TOLERANCE = String(TOLERANCE);
  });
  afterEach(() => {
    delete process.env.WAVE_WEBHOOK_SECRET;
    delete process.env.WAVE_WEBHOOK_TOLERANCE;
  });

  it("accepte une signature valide sur le corps brut", () => {
    const body = JSON.stringify({ type: "checkout.session.completed" });
    expect(verifyWaveSignature(body, sign(body))).toBe(true);
  });

  it("rejette un mauvais secret", () => {
    const body = JSON.stringify({ type: "checkout.session.completed" });
    expect(verifyWaveSignature(body, sign(body, "whsec_wrong"))).toBe(false);
  });

  it("rejette un corps modifié (tampering)", () => {
    const body = "{\"amount\":\"1000\"}";
    const tampered = "{\"amount\":\"9999\"}";
    expect(verifyWaveSignature(tampered, sign(body))).toBe(false);
  });

  it("rejette un header absent", () => {
    expect(verifyWaveSignature("{}", null)).toBe(false);
    expect(verifyWaveSignature("{}", "")).toBe(false);
  });

  it("rejette un horodatage hors tolérance", () => {
    const body = "{}";
    const old = Math.floor(Date.now() / 1000) - TOLERANCE - 60;
    expect(verifyWaveSignature(body, sign(body, SECRET, old))).toBe(false);
  });
});

describe("amountMatches", () => {
  it("compare un montant chaîne à un entier", () => {
    expect(amountMatches("5000", 5000)).toBe(true);
    expect(amountMatches("5000", 5001)).toBe(false);
    expect(amountMatches(5000, 5000)).toBe(true);
    expect(amountMatches(null, 5000)).toBe(false);
  });
});

describe("isCheckoutCompleted", () => {
  it("ne traite que checkout.session.completed", () => {
    expect(isCheckoutCompleted({ type: "checkout.session.completed", data: {} })).toBe(true);
    expect(isCheckoutCompleted({ type: "checkout.session.payment_failed", data: {} })).toBe(false);
    expect(isCheckoutCompleted({ type: "test.test_event", data: {} })).toBe(false);
  });
});