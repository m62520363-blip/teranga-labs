import { describe, expect, it } from "vitest";
import { rateLimit, clientIp } from "@/lib/rate-limit";

describe("rateLimit", () => {
  it("autorise les appels sous la limite puis bloque au dépassement", () => {
    const key = `test:${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      expect(rateLimit(key, 3).ok).toBe(true);
    }
    const blocked = rateLimit(key, 3);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("retourne un Retry-After borné à la fenêtre", () => {
    const key = `test:${Date.now()}`;
    rateLimit(key, 1);
    const blocked = rateLimit(key, 1);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("isole les fenêtres par clé", () => {
    const a = `a:${Date.now()}`;
    const b = `b:${Date.now()}`;
    rateLimit(a, 1);
    expect(rateLimit(a, 1).ok).toBe(false);
    expect(rateLimit(b, 1).ok).toBe(true);
  });
});

describe("clientIp", () => {
  it("privilégie x-forwarded-for", () => {
    const req = new Request("https://teranga-labs.vercel.app/api/x", {
      headers: { "x-forwarded-for": "41.82.10.10, 10.0.0.1" },
    });
    expect(clientIp(req)).toBe("41.82.10.10");
  });

  it("tombe sur x-real-ip sinon", () => {
    const req = new Request("https://teranga-labs.vercel.app/api/x", {
      headers: { "x-real-ip": "197.10.2.3" },
    });
    expect(clientIp(req)).toBe("197.10.2.3");
  });

  it("renvoie 'unknown' sans en-tête", () => {
    expect(clientIp(new Request("https://teranga-labs.vercel.app/api/x"))).toBe("unknown");
  });
});