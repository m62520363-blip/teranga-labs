import { test, expect } from "@playwright/test";

const PUBLIC_PAGES: { path: string; fragment: string | RegExp }[] = [
  { path: "/plan-du-site", fragment: /plan/i },
  { path: "/conditions-utilisation", fragment: /conditions/i },
  { path: "/faq", fragment: /foire aux questions|faq/i },
  { path: "/a-propos", fragment: /propos/i },
];

test.describe("pages publiques statiques", () => {
  for (const { path, fragment } of PUBLIC_PAGES) {
    test(`la page ${path} se charge sans erreur`, async ({ page }) => {
      const response = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `${path} répond 200`).toBe(200);
      await expect(page.locator("body")).toContainText(fragment);
      await expect(page.locator("header").first()).toBeVisible();
    });
  }

  test("une route inconnue affiche la page 404", async ({ page }) => {
    const response = await page.goto("/route-inexistante-xyz", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(404);
  });
});

test.describe("navigation d'en-tête du site", () => {
  test("les liens du header mènent à des pages valides", async ({ page }) => {
    await page.goto("/a-propos", { waitUntil: "domcontentloaded" });
    const header = page.locator("header").first();
    for (const target of ["/agences", "/dev", "/briefs", "/faq"]) {
      const link = header.locator(`a[href="${target}"]`).first();
      await expect(link, `lien ${target} présent dans le header`).toBeVisible();
      await expect(page.goto(target)).resolves.toBeTruthy();
    }
  });
});