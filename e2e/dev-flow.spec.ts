import { test, expect } from "@playwright/test";

test.describe("Espace développeur", () => {
  test("la page /dev se charge et affiche les développeurs", async ({ page }) => {
    await page.goto("/dev", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2000);
    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test("la page /classement se charge", async ({ page }) => {
    await page.goto("/classement", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2000);
    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(100);
  });

  test("la page /abonnement se charge et affiche les plans", async ({ page }) => {
    await page.goto("/abonnement", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(3000);
    const text = await page.locator("body").innerText();
    expect(text).toContain("FCFA");
  });

  test("la page /dashboard redirige vers /login si non connecté", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2000);
    expect(page.url()).toContain("/login");
  });
});

test.describe("Espace client", () => {
  test("la page /client redirige vers /login si non connecté", async ({ page }) => {
    await page.goto("/client", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2000);
    expect(page.url()).toContain("/login");
  });

  test("la page /poster se charge et affiche le formulaire", async ({ page }) => {
    await page.goto("/poster", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(3000);
    const form = page.locator("form").first();
    await expect(form).toBeVisible({ timeout: 15_000 });
  });

  test("la page /client/briefs redirige vers /login si non connecté", async ({ page }) => {
    await page.goto("/client/briefs", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2000);
    expect(page.url()).toContain("/login");
  });
});

test.describe("Administration", () => {
  test("la page /admin redirige vers /login si non connecté", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2000);
    expect(page.url()).toContain("/login");
  });
});

test.describe("Pages publiques", () => {
  test("la page /briefs se charge", async ({ page }) => {
    await page.goto("/briefs", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(3000);
    const text = await page.locator("body").innerText();
    expect(text).toContain("PROJETS OUVERTS");
  });

  test("la page /parrainage redirige vers /login si non connecté", async ({ page }) => {
    await page.goto("/parrainage", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2000);
    expect(page.url()).toContain("/login");
  });

  test("la page /404 affiche la page introuvable", async ({ page }) => {
    await page.goto("/page-inexistante-test-qa", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2000);
    const text = await page.locator("body").innerText();
    expect(text).toContain("introuvable");
  });
});
