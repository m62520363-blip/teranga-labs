import { test, expect, type Page } from "@playwright/test";

/**
 * Verrouille le parcours d'authentification reproduit depuis la référence
 * Montaaj :
 *   - colonne centrée nue (aucune navbar / footer / dock sur /login et
 *     /signup) avec le logo cliquable ;
 *   - structure des deux formulaires (identifiants sémantiques : h1, champs,
 *     bascule de rôle aria-pressed, pilule de soumission) ;
 *   - messages d'erreur français pilotés par zod côté client, sans jamais
 *     déclencher d'appel réseau (soumissions invalides uniquement) ;
 *   - le WhatsApp client reste optionnel (la saisie vide est acceptée).
 *
 * Aucun soumission valide : les tests ne doivent jamais toucher Supabase.
 */

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };

async function gotoAuth(page: Page, path: string, viewport = DESKTOP) {
  await page.setViewportSize(viewport);
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response?.status(), `${path} répond 200`).toBe(200);
  // Les interactions React (soumissions, bascules, révélateurs) ne sont
  // actives qu'après hydratation : on attend la fin des requêtes — le
  // prefetch des liens Next part de React monté.
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
}

async function expectBareChrome(page: Page) {
  // Routes « nues » : le chrome de site est absent du DOM (pas masqué).
  await expect(page.getByRole("navigation", { name: "Navigation principale" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Navigation rapide" })).toHaveCount(0);
  await expect(page.locator("footer")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "TERANGA LABS — accueil" })).toBeVisible();
}

test.describe("page de connexion (/login)", () => {
  test("structure Montaaj : titre, champs, pilule, options", async ({ page }) => {
    await gotoAuth(page, "/login");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Content de vous revoir.");
    await expect(page.getByText("Connectez-vous pour continuer.")).toBeVisible();
    await expectBareChrome(page);

    await expect(page.locator("#login-email")).toBeVisible();
    await expect(page.locator("#login-password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Mot de passe oublié ?" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
    await expect(page.getByText("ou", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Recevoir un code par SMS" })).toBeVisible();
    await expect(page.getByRole("link", { name: "S'inscrire" })).toHaveAttribute("href", "/signup");
  });

  test("afficher / masquer le mot de passe", async ({ page }) => {
    await gotoAuth(page, "/login");
    const password = page.locator("#login-password");

    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Afficher le mot de passe" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Masquer le mot de passe" }).click();
    await expect(password).toHaveAttribute("type", "password");
  });

  test("validation française, sans appel réseau", async ({ page }) => {
    await gotoAuth(page, "/login");

    await page.getByRole("button", { name: "Se connecter" }).click();

    await expect(page.getByText("Adresse email invalide.")).toBeVisible();
    await expect(page.getByText("Le mot de passe est requis.")).toBeVisible();
    // Rien n'a été envoyé : on est toujours sur la page de connexion.
    expect(page.url()).toContain("/login");
  });

  test("bascule vers la connexion par SMS puis retour par email", async ({ page }) => {
    await gotoAuth(page, "/login");

    await page.getByRole("button", { name: "Recevoir un code par SMS" }).click();
    await expect(page.getByRole("heading", { name: "Connexion par SMS" })).toBeVisible();
    await expect(page.locator("#otp-phone")).toBeVisible();

    await page.getByRole("button", { name: "Revenir à la connexion par email" }).click();
    await expect(page.locator("#login-email")).toBeVisible();
  });

  test("mobile 390×844 : formulaire seul, sans chrome", async ({ page }) => {
    await gotoAuth(page, "/login", MOBILE);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectBareChrome(page);
  });
});

test.describe("page d'inscription (/signup)", () => {
  test("structure Montaaj : h1, bascule de rôle, champs client", async ({ page }) => {
    await gotoAuth(page, "/signup");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Créez votre compte");
    await expectBareChrome(page);

    const client = page.getByRole("button", { name: "Je suis client" });
    const developer = page.getByRole("button", { name: "Je suis développeur" });
    await expect(client).toHaveAttribute("aria-pressed", "true");
    await expect(developer).toHaveAttribute("aria-pressed", "false");

    await expect(page.locator("#signup-name")).toBeVisible();
    await expect(page.locator("#signup-company")).toBeVisible();
    await expect(page.locator("#signup-city")).toBeVisible();
    await expect(page.locator("#signup-email")).toBeVisible();
    await expect(page.locator("#signup-password")).toBeVisible();
    await expect(page.locator("#signup-confirm")).toBeVisible();
    await expect(page.locator("#signup-whatsapp")).toBeVisible();
    await expect(page.getByRole("checkbox")).toBeVisible();
    await expect(page.getByRole("button", { name: "Créer mon compte" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Se connecter" })).toHaveAttribute("href", "/login");
    // WhatsApp facultatif côté client.
    await expect(page.getByText("WhatsApp (optionnel)")).toBeVisible();
  });

  test("bascule vers le rôle développeur", async ({ page }) => {
    await gotoAuth(page, "/signup");

    await page.getByRole("button", { name: "Je suis développeur" }).click();

    await expect(page.getByRole("button", { name: "Je suis client" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    await expect(page.getByRole("button", { name: "Je suis développeur" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(page.locator("#signup-skills")).toBeVisible();
    await expect(page.locator("#signup-company")).toHaveCount(0);
    await expect(page.locator("#signup-city")).toHaveCount(0);
    // WhatsApp devient requis : le libellé perd sa mention « optionnel ».
    const whatsappLabel = page.locator('label[for="signup-whatsapp"]');
    await expect(whatsappLabel).toContainText("WhatsApp");
    await expect(whatsappLabel).not.toContainText("optionnel");
  });

  test("?role=developer pré-sélectionne le développeur", async ({ page }) => {
    await gotoAuth(page, "/signup?role=developer");
    await expect(page.getByRole("button", { name: "Je suis développeur" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(page.locator("#signup-skills")).toBeVisible();
    await expect(page.locator("#signup-company")).toHaveCount(0);
  });

  test("/login?mode=signup affiche l'inscription", async ({ page }) => {
    await gotoAuth(page, "/login?mode=signup&role=developer");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Créez votre compte");
    await expect(page.getByRole("button", { name: "Je suis développeur" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  test("validation française client — WhatsApp vide accepté", async ({ page }) => {
    await gotoAuth(page, "/signup");

    await page.getByRole("button", { name: "Créer mon compte" }).click();

    await expect(page.locator("#signup-name")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Votre nom est trop court.")).toBeVisible();
    await expect(page.getByText("Adresse email invalide.")).toBeVisible();
    await expect(page.getByText("Au moins 8 caractères.")).toBeVisible();
    await expect(page.getByText("Confirmez votre mot de passe.")).toBeVisible();
    await expect(
      page.getByText(
        "Vous devez accepter les conditions d'utilisation et la politique de confidentialité."
      )
    ).toBeVisible();
    // Régression : le champ WhatsApp client vide ne bloque plus l'inscription.
    await expect(page.getByText("Numéro WhatsApp invalide.")).toHaveCount(0);
    expect(page.url()).toContain("/signup");
  });

  test("confirmation de mot de passe différente", async ({ page }) => {
    await gotoAuth(page, "/signup");

    await page.locator("#signup-name").fill("Awa Ndiaye");
    await page.locator("#signup-email").fill("awa@exemple.com");
    await page.locator("#signup-password").fill("Motdepasse1");
    await page.locator("#signup-confirm").fill("Motdepasse2");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Créer mon compte" }).click();

    await expect(page.getByText("Les mots de passe ne correspondent pas.")).toBeVisible();
    expect(page.url()).toContain("/signup");
  });

  test("navigation croisée login ↔ signup", async ({ page }) => {
    await gotoAuth(page, "/signup");
    await page.getByRole("link", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByRole("link", { name: "S'inscrire" }).click();
    await expect(page).toHaveURL(/\/signup$/);
  });

  test("mobile 390×844 : formulaire seul, sans chrome", async ({ page }) => {
    await gotoAuth(page, "/signup", MOBILE);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Je suis client" })).toBeVisible();
    await expectBareChrome(page);
  });
});
