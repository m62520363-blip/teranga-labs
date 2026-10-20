import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Flux de paiement Chariow des missions — garde-fous.
 *
 * Convention e2e du projet : AUCUN compte réel, AUCUNE mutation
 * Supabase. On verrouille uniquement les barrières exécutées AVANT
 * toute écriture :
 *   - /api/payments/mission-checkout refuse sans session (401) et
 *     sans configuration (503), jamais de session Chariow ouverte ;
 *   - /api/payments/webhook refuse tout Pulse non signé (401) ou non
 *     configuré (503) : aucune confirmation de paiement possible ;
 *   - /missions/:id sans session redirige vers /login.
 *
 * Attention au rate-limit (10 req/min/IP sur mission-checkout) : ce
 * fichier reste bien en dessous de cette limite.
 */

function envValue(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  try {
    const line = readFileSync(join(process.cwd(), ".env.local"), "utf8")
      .split(/\r?\n/)
      .find((l) => l.startsWith(`${name}=`));
    return line ? line.slice(name.length + 1).trim() : undefined;
  } catch {
    return undefined;
  }
}

const hasSupabase = Boolean(
  envValue("NEXT_PUBLIC_SUPABASE_URL") && envValue("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
);

const UUID = "11111111-2222-4333-8444-555555555555";

test.describe("paiement de mission : gardes (nécessite Supabase)", () => {
  test.skip(!hasSupabase, "variables NEXT_PUBLIC_SUPABASE_* absentes");

  test("sans session, mission-checkout répond 401 et n'ouvre aucune session", async ({
    request,
  }) => {
    const res = await request.post("/api/payments/mission-checkout", {
      data: { missionId: UUID },
    });
    expect([401, 503], `statut reçu ${res.status()}`).toContain(res.status());
    const body = (await res.json().catch(() => null)) as { code?: string } | null;
    expect(body?.code, "code d'erreur métier").toMatch(/^(UNAUTHENTICATED|PAYMENT_NOT_CONFIGURED|DB_NOT_CONFIGURED|RATE_LIMITED)$/);
    if (res.status() === 401) {
      expect(body?.code).toBe("UNAUTHENTICATED");
      expect(body).not.toHaveProperty("launchUrl");
    }
  });

  test("mission-checkout refuse un corps invalide (400 ou 503)", async ({ request }) => {
    const res = await request.post("/api/payments/mission-checkout", {
      data: { notMissionId: true },
    });
    expect([400, 401, 503, 429], `statut reçu ${res.status()}`).toContain(res.status());
    const body = (await res.json().catch(() => null)) as { code?: string } | null;
    expect(body).not.toBeNull();
    expect(body).not.toHaveProperty("launchUrl");
  });

  test("le webhook refuse un Pulse sans signature valide", async ({ request }) => {
    const res = await request.post("/api/payments/webhook", {
      data: { kind: "mission", sale_id: "sale_e2e", status: "paid" },
      headers: { "chariow-signature": "invalid" },
    });
    expect([401, 503], `statut reçu ${res.status()}`).toContain(res.status());
    const body = (await res.json().catch(() => null)) as { code?: string; error?: string } | null;
    expect(body).not.toBeNull();
    expect(res.status(), "jamais de confirmation non signée").not.toBe(200);
  });

  test("sans session, /missions/:id redirige vers /login", async ({ page }) => {
    await page.goto(`/missions/${UUID}`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login/);
  });
});
