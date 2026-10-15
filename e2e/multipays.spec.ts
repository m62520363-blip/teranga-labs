import { test, expect, type Page } from "@playwright/test";
import { COUNTRIES, getFlagUrl } from "@/lib/countries";
import { allCountrySlugs } from "@/lib/geography";
import { allRegionSlugs, slugifyRegion } from "@/lib/region-slugs";

/**
 * Couverture des surfaces MULTI-PAYS livrées en P5-ter/quater.
 *
 * Les tests statiques existants ne touchaient aucune de ces pages ; le seul
 * signalement d'un bug (drapeaux 404, voir CHANGELOG P5-sept) venait d'une
 * erreur image remontée par hasard. Ici on verrouille directement :
 *  - l'index /ville (9 pays groupés, 93 entrées / 92 URLs après dédup Savanes),
 *  - une page /ville/[region] par pays (dérivation du pays dans le title),
 *  - l'index /pays et ses 9 cartes,
 *  - les 9 pages /pays/[slug],
 *  - le sitemap (92 + 9 entrées géographiques),
 *  - le sélecteur d'indicatif (9 pays) sur l'inscription,
 *  - et surtout : AUCUNE image drapeau en erreur réseau.
 */

const REGION_TOTAL = COUNTRIES.flatMap((c) => c.regions).length;
const REGION_SLUGS = allRegionSlugs();
const COUNTRY_SLUGS = allCountrySlugs();

/** largeurs réellement publiées par flagcdn (voir lib/countries.ts). */
const PUBLISHED_WIDTHS = [20, 40, 80, 160, 320, 640, 1280];

/** Enregistre les requêtes d'image renvoyant une erreur serveur. */
function trackFailedImages(page: Page): string[] {
  const failures: string[] = [];
  page.on("response", (res) => {
    const url = res.url();
    if ((url.includes("/_next/image") || url.includes("flagcdn.com")) && res.status() >= 400) {
      failures.push(`${res.status()} ${url}`);
    }
  });
  page.on("requestfailed", (req) => {
    const url = req.url();
    if (url.includes("/_next/image") || url.includes("flagcdn.com")) {
      failures.push(`FAILED ${url}`);
    }
  });
  return failures;
}

test.describe("index /ville (régions des 9 pays)", () => {
  test("liste les 9 pays et toutes les régions du référentiel", async ({ page }) => {
    const failures = trackFailedImages(page);
    const response = await page.goto("/ville", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);

    // Les 9 pays en title de section (exact : « Guinée » sinon matche aussi
    // « Guinée-Bissau » et viole le strict mode de Playwright).
    for (const country of COUNTRIES) {
      await expect(
        page.getByRole("heading", { level: 2, name: country.nameFr, exact: true }),
        `section ${country.nameFr}`
      ).toBeVisible();
    }

    // Cross-vérification lib -> DOM : une entrée par région (93), et
    // 92 URLs uniques après déduplication de « Savanes » (CI + TG).
    const links = page.locator('a[href^="/ville/"]');
    await expect(links).toHaveCount(REGION_TOTAL);

    const hrefs = await links.evaluateAll((els) =>
      els.map((e) => e.getAttribute("href") as string)
    );
    expect(new Set(hrefs).size).toBe(REGION_SLUGS.length);

    // Footer présent sur chaque page : il rend 9 drapeaux (w40, valides).
    // On vérifie donc le RÉSEAU et non un comptage d'images.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForLoadState("networkidle");
    expect(failures, "aucune image en erreur sur /ville").toEqual([]);
  });

  test("chaque URL de région du référentiel répond 200", async ({ page }) => {
    // Échantillon : première région de chaque pays — une par pays.
    for (const country of COUNTRIES) {
      const region = country.regions[0];
      const slug = slugifyRegion(region.name);
      const response = await page.goto(`/ville/${slug}`, {
        waitUntil: "domcontentloaded",
      });
      expect(response?.status(), `/ville/${slug}`).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(region.name);
    }
  });

  test("une région inconnue renvoie 404", async ({ page }) => {
    const response = await page.goto("/ville/ville-inexistante-xyz", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(404);
  });
});

test.describe("pages /ville/[region]", () => {
  test("le pays dérivé du slug apparaît dans la page (1 échantillon par pays)", async ({
    page,
  }) => {
    for (const country of COUNTRIES) {
      const region = country.regions[0];
      await page.goto(`/ville/${slugifyRegion(region.name)}`, {
        waitUntil: "domcontentloaded",
      });
      // L'entête porte le nom du pays dérivé via countryCodeForRegionSlug.
      await expect(
        page.locator("p").filter({ hasText: country.nameFr }).first(),
        `${region.name} devrait être rattaché à ${country.nameFr}`
      ).toBeVisible();
      // Le title metadata nomme la région.
      await expect(page).toHaveTitle(new RegExp(region.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });
});

test.describe("index /pays", () => {
  test("affiche les 9 cartes pays avec des drapeaux valides", async ({ page }) => {
    const failures = trackFailedImages(page);
    const response = await page.goto("/pays", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);

    await expect(page.getByRole("heading", { level: 1 })).toContainText("9 pays");

    for (const { country, slug } of COUNTRY_SLUGS) {
      const card = page.locator(`a[href="/pays/${slug}"]`);
      await expect(card, `carte ${country.nameFr}`).toHaveCount(1);
      await expect(card).toContainText(country.nameFr);
    }

    // Le src de chaque drapeau (via next/image) référence une largeur publiée.
    const srcs = await page
      .locator('img[src*="flagcdn"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute("src") as string));
    expect(srcs.length).toBeGreaterThan(0);
    for (const src of srcs) {
      const decoded = decodeURIComponent(src);
      const m = /flagcdn\.com\/w(\d+)\//.exec(decoded);
      expect(m, decoded).toBeTruthy();
      expect(PUBLISHED_WIDTHS, decoded).toContain(Number(m![1]));
    }

    // Forcer le chargement (images lazy) puis contrôler le réseau.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForLoadState("networkidle");
    expect(failures, "aucune image drapeau en erreur").toEqual([]);
  });
});

test.describe("pages /pays/[slug]", () => {
  test("les 9 pages pays répondent 200 et nomment le pays", async ({ page }) => {
    const failures = trackFailedImages(page);
    for (const { country, slug } of COUNTRY_SLUGS) {
      const response = await page.goto(`/pays/${slug}`, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `/pays/${slug}`).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        `Développeurs web en ${country.nameFr}`
      );
      // Toutes les régions du pays sont listées.
      const items = page.locator('a[href*="region="]');
      await expect(items).toHaveCount(country.regions.length);
    }
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForLoadState("networkidle");
    expect(failures, "aucune image drapeau en erreur").toEqual([]);
  });

  test("un pays inconnu renvoie 404", async ({ page }) => {
    const response = await page.goto("/pays/atlas-xyz", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(404);
  });
});

test.describe("sitemap géographique", () => {
  test("publie 92 URLs /ville et 9 URLs /pays", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    const xml = await response.text();

    const ville = [...xml.matchAll(/<loc>[^<]*\/ville\/([^<]+)<\/loc>/g)].map((m) => m[1]);
    const pays = [...xml.matchAll(/<loc>[^<]*\/pays\/([^<]+)<\/loc>/g)].map((m) => m[1]);

    expect(ville.length).toBe(REGION_SLUGS.length);
    expect(new Set(ville).size).toBe(REGION_SLUGS.length);
    expect(pays.length).toBe(COUNTRY_SLUGS.length);
    for (const { slug } of COUNTRY_SLUGS) expect(pays).toContain(slug);
  });
});

test.describe("sélecteur d'indicatif (inscription)", () => {
  test("propose les 9 pays du périmètre", async ({ page }) => {
    await page.goto("/login?mode=signup", { waitUntil: "domcontentloaded" });
    // Attendre l'hydratation React : une interaction avant hydratation échoue
    // silencieusement (constaté en probe — le popup ne s'ouvrait pas).
    await page.waitForLoadState("networkidle");

    const trigger = page.locator('[aria-label="Indicatif pays"]');
    await expect(trigger).toBeVisible();
    // La valeur par défaut est l'indicatif du siège (Sénégal).
    await expect(trigger).toContainText("+221");

    await trigger.click();
    const options = page.getByRole("option");
    await expect(options).toHaveCount(COUNTRIES.length);

    // On s'ancre sur l'indicatif (unique) puis on vérifie le nom du pays :
    // un filtre sur le nom seul matcherait « Guinée » dans « Guinée-Bissau ».
    for (const country of COUNTRIES) {
      const option = options.filter({ hasText: country.phoneCode });
      await expect(option, `option ${country.phoneCode}`).toHaveCount(1);
      await expect(option).toContainText(country.nameFr);
    }
  });
});

test.describe("largeurs de drapeau publiées (régression P5-sept)", () => {
  test("getFlagUrl ne cible que des largeurs servies par flagcdn", async () => {
    for (const country of COUNTRIES) {
      for (const size of [16, 20, 24, 32, 48] as const) {
        const url = getFlagUrl(country.code, size);
        const m = /\/w(\d+)\//.exec(url);
        expect(m, url).toBeTruthy();
        expect(PUBLISHED_WIDTHS, `${country.code}@${size} -> ${url}`).toContain(Number(m![1]));
      }
    }
  });
});
