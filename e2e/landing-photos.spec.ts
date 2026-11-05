import { test, expect } from "@playwright/test";

test.describe("landing : photos et nettoyage Tokens", () => {
  test("les 5 photos de sections sont présentes et chargées", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(4000);
    const allImgs = page.locator("img");
    const count = await allImgs.count();
    let landingCount = 0;
    for (let i = 0; i < count; i++) {
      const src = await allImgs.nth(i).getAttribute("src");
      if (src && src.includes("landing")) landingCount++;
    }
    expect(landingCount, "au moins 5 photos de sections").toBeGreaterThanOrEqual(5);

    for (let i = 0; i < count; i++) {
      const src = await allImgs.nth(i).getAttribute("src");
      if (src && src.includes("landing")) {
        const img = allImgs.nth(i);
        await img.scrollIntoViewIfNeeded();
        await expect
          .poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth), {
            timeout: 10_000,
          })
          .toBeGreaterThan(0);
      }
    }
  });

  test("aucune occurrence de « Token » sur la landing (FR)", async ({ page }) => {
    await page.goto("/fr", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2000);
    const text = await page.locator("body").innerText();
    expect(text.match(/\bTokens?\b/gi) ?? []).toHaveLength(0);
  });

  test("/tokens redirige vers /abonnement", async ({ page }) => {
    await page.goto("/fr/tokens", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForURL(/\/abonnement/, { timeout: 15_000 });
    expect(page.url()).toContain("/abonnement");
  });

  test("/abonnement affiche les 3 tarifs d'abonnement", async ({ page }) => {
    await page.goto("/fr/abonnement", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2000);
    const text = await page.locator("body").innerText();
    expect(text).toMatch(/2\s*500/);
    expect(text).toMatch(/7\s*000/);
    expect(text).toMatch(/15\s*000/);
  });

  test("le hero affiche le bandeau de preuve sociale", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(4000);
    await expect(page.getByText("Des développeurs vérifiés dans 54 pays")).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("dashboard développeur (page protégée)", () => {
  test("un visiteur est redirigé vers /login", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    expect(page.url()).toContain("/login");
  });
});
