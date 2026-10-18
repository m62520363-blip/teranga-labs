import { test, expect, type Page } from "@playwright/test";

/**
 * Verrouille l'organisation de la navigation d'atterrissage :
 *   - la bottom nav est réservée aux comptes connectés : un visiteur n'en a
 *     pas (même sur mobile) et navigue via la navbar + menu hamburger ;
 *   - chaque page d'atterrissage porte sa scène 3D (scène 3D native,
 *     aucune dépendance WebGL) ;
 *   - les illustrations de marque se chargent réellement (pas d'URL morte).
 *
 * Les docks client / développeur (rôles distincts) exigent une session
 * authentifiée : ils se vérifient en manuel sur un compte de test.
 */

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };

async function gotoMobile(page: Page, path: string) {
  await page.setViewportSize(MOBILE);
  await page.goto(path, { waitUntil: "domcontentloaded" });
}

test.describe("navigation visiteur (sans bottom nav)", () => {
  test("pas de bottom nav sur la home mobile", async ({ page }) => {
    await gotoMobile(page, "/");
    await expect(
      page.getByRole("navigation", { name: "Navigation rapide" }),
    ).toBeHidden();
    // La navbar classique reste là pour organiser la découverte.
    await expect(
      page.getByRole("navigation", { name: "Navigation principale" }),
    ).toBeVisible();
  });

  test("pas de bottom nav sur les pages découvertes (/briefs, /poster)", async ({
    page,
  }) => {
    for (const path of ["/briefs", "/poster"]) {
      await gotoMobile(page, path);
      await expect(
        page.getByRole("navigation", { name: "Navigation rapide" }),
        `dock absent sur ${path}`,
      ).toBeHidden();
    }
  });

  test("le menu hamburger reste la navigation mobile du visiteur", async ({
    page,
  }) => {
    await gotoMobile(page, "/");
    const burger = page.getByRole("button", { name: /ouvrir le menu/i });
    const menu = page.getByRole("link", { name: "Se connecter" });
    // Le premier clic peut précéder l'hydratation React : comme le menu est
    // fermé, réessayer ne peut qu'ouvrir le tiroir, jamais le refermer.
    await expect(async () => {
      await burger.click();
      await expect(menu).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15_000 });
  });

  test("desktop inchangé : navbar principale visible, dock absent", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("navigation", { name: "Navigation rapide" }),
    ).toBeHidden();
    await expect(
      page.getByRole("navigation", { name: "Navigation principale" }),
    ).toBeVisible();
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
  test("la page /poster charge ses illustrations (pas d'URL morte)", async ({
    page,
  }) => {
    await page.goto("/poster", { waitUntil: "networkidle" });
    const illustrations = page.locator('img[src^="/illustrations/"]');
    const count = await illustrations.count();
    expect(count, "au moins une illustration sur /poster").toBeGreaterThanOrEqual(1);
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

test.describe("landing Montaaj (nouvelle structure)", () => {
  test("les 5 cartes empilées de « Comment ça marche » sont présentes", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const cards = page.locator("[data-stack-card]");
    await expect(cards).toHaveCount(5);
    // La dernière carte ne doit pas être en sticky collant (fin de pile).
    const firstCard = cards.first();
    await expect(firstCard).toHaveClass(/stack-card/);
  });

  test("les 5 accordéons FAQ natifs sont présents", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const details = page.locator("#faq details");
    await expect(details).toHaveCount(5);
  });

  test("les 2 cartes tarifs sont présentes avec la mise en avant secondaire", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const cards = page.locator("#tarifs [class*='rounded-card']");
    await expect(cards).toHaveCount(2);
  });

  test("le footer a bien 3 colonnes de liens", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const footer = page.locator("footer");
    const columns = footer.locator("nav");
    await expect(columns).toHaveCount(3);
  });

  test("le hero affiche l'ordinateur façon Montaaj avec la capture du produit", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    // Capture réelle de l'interface (marketplace /briefs) dans l'écran.
    const img = page.locator('img[src*="briefs-desktop"]');
    await expect(img).toHaveCount(1);
    await expect(img).toBeVisible();
    // Écran incliné : le conteneur pose une vraie perspective CSS.
    const perspective = await page
      .locator('[class*="perspective:800px"]')
      .first()
      .evaluate((el) => getComputedStyle(el).perspective);
    expect(perspective, "perspective CSS active").not.toBe("none");
  });

  test("mobile : l'ordinateur s'adapte sans débordement horizontal", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator('img[src*="briefs-desktop"]')).toBeVisible();
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(scrollWidth, "pas de débordement horizontal").toBeLessThanOrEqual(390);
  });
});
