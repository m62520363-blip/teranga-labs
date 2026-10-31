import { test, expect } from "@playwright/test";

test.describe("page /poster (publication de brief)", () => {
  test("la page se charge et affiche le formulaire", async ({ page }) => {
    await page.goto("/poster", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(3000);
    // Le formulaire de publication doit être présent.
    await expect(page.locator("form").first()).toBeVisible({ timeout: 15_000 });
    // Aucune occurrence de « Token ».
    const text = await page.locator("body").innerText();
    expect(text.match(/\bTokens?\b/gi) ?? []).toHaveLength(0);
  });

  test("mobile : pas de débordement horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/poster", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(3000);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(390);
  });
});

test.describe("boost de brief (API)", () => {
  test("POST sans payload renvoie 400 (route déployée)", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 90_000 });
    const res = await page.evaluate(async () => {
      const r = await fetch("/api/payments/brief-boost-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      return r.status;
    });
    expect(res).toBe(400);
  });
});
