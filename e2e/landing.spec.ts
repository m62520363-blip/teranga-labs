import { test, expect, type Page } from "@playwright/test";

/**
 * Verrouille l'organisation de la navigation et la présence des visuels
 * d'atterrissage introduits avec la bottom nav visiteur et les scènes 3D :
 *   - la bottom nav est visible sur mobile pour un visiteur (pas seulement
 *     pour les comptes connectés) et masquée sur desktop ;
 *   - chaque page d'atterrissage porte sa scène 3D (scène 3D native,
 *     aucune dépendance WebGL) ;
 *   - les illustrations de marque se chargent réellement (pas d'URL morte).
 */

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };

const DOCK_LABELS = ["Accueil", "Dévs", "Publier", "Briefs", "Compte"];

async function gotoMobile(page: Page, path: string) {
  await page.setViewportSize(MOBILE);
  await page.goto(path, { waitUntil: "domcontentloaded" });
}

test.describe("bottom nav visiteur", () => {
  test("visible sur mobile avec les 5 destinations", async ({ page }) => {
    await gotoMobile(page, "/");
    const dock = page.getByRole("navigation", { name: "Navigation rapide" });
    await expect(dock).toBeVisible();
    for (const label of DOCK_LABELS) {
      await expect(dock.getByRole("link", { name: label })).toBeVisible();
    }
  });

  test("l'action centrale Publier mène à /poster", async ({ page }) => {
    await gotoMobile(page, "/");
    const dock = page.getByRole("navigation", { name: "Navigation rapide" });
    await dock.getByRole("link", { name: "Publier" }).click();
    await expect(page).toHaveURL(/\/poster/);
  });

  test("masquée sur desktop (la navbar classique prend le relais)", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("navigation", { name: "Navigation rapide" })).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Navigation principale" })).toBeVisible();
  });

  test("l'état actif est bien marqué (aria-current)", async ({ page }) => {
    await gotoMobile(page, "/briefs");
    const dock = page.getByRole("navigation", { name: "Navigation rapide" });
    const current = dock.locator('[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toContainText("Briefs");
  });
});

test.describe("scènes 3D des pages d'atterrissage", () => {
  const pages: { path: string; name: string }[] = [
    { path: "/", name: "accueil" },
    { path: "/classement", name: "classement" },
    { path: "/agences", name: "agences" },
    { path: "/a-propos", name: "à propos" },
  ];

  for (const p of pages) {
    test(`${p.name} : une scène 3D est présente`, async ({ page }) => {
      await page.goto(p.path, { waitUntil: "domcontentloaded" });
      const scene = page.locator(".scene3d").first();
      await expect(scene).toBeAttached();
      // La scène doit être réellement en 3D (perspective posée sur le conteneur).
      const perspective = await scene.evaluate(
        (el) => getComputedStyle(el).perspective,
      );
      expect(perspective, "perspective CSS active").not.toBe("none");
    });
  }
});

test.describe("illustrations de marque", () => {
  test("la home charge ses illustrations (pas d'URL morte)", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const illustrations = page.locator('img[src^="/illustrations/"]');
    const count = await illustrations.count();
    expect(count, "au moins deux illustrations sur la home").toBeGreaterThanOrEqual(2);
    for (let i = 0; i < count; i++) {
      const img = illustrations.nth(i);
      await img.scrollIntoViewIfNeeded();
      await expect
        .poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth), {
          timeout: 10_000,
        })
        .toBeGreaterThan(0);
    }
  });
});
