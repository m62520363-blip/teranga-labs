import { test, expect, type Page } from "@playwright/test";

/**
 * Verrouille le parcours d'inscription développeur guidé (référence Montaaj) :
 *   1. « Crée ton compte » — champs, jauge, CGU, validation française ;
 *   2. « Vérifie ton email » — code à 6 chiffres, envoi auto, renvoi avec
 *      délai, erreurs FR (via interception des appels Supabase, aucun compte
 *      réel créé) ;
 *   3. reprise de la progression après rafraîchissement (sessionStorage).
 */

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };

async function gotoFunnel(page: Page, viewport = DESKTOP) {
  await page.setViewportSize(viewport);
  const response = await page.goto("/inscription-developpeur", {
    waitUntil: "domcontentloaded",
  });
  expect(response?.status(), "/inscription-developpeur répond 200").toBe(200);
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
}

async function fillAccountForm(page: Page) {
  await page.locator("#devreg-email").fill("e2e.dev.funnel@example.com");
  await page.locator("#devreg-password").fill("Test1234!");
  await page.locator("#devreg-confirm").fill("Test1234!");
  await page.locator("#devreg-terms").check();
}

/** Intercepte les appels auth Supabase : signup sans session + OTP envoyé +
    verify en échec (code expiré). Aucun compte réel, aucune fuite réseau.
    Patterns en RegExp : supabase-js ajoute `?redirect_to=…` aux URLs. */
async function mockSupabaseAuth(page: Page) {
  await page.route(/\/auth\/v1\/signup/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "11111111-1111-1111-1111-111111111111",
        aud: "authenticated",
        role: "authenticated",
        email: "e2e.dev.funnel@example.com",
        phone: "",
        app_metadata: { provider: "email", providers: ["email"] },
        user_metadata: { role: "developer" },
        identities: [],
        created_at: "2026-10-18T12:00:00.000Z",
        updated_at: "2026-10-18T12:00:00.000Z",
      }),
    })
  );
  await page.route(/\/auth\/v1\/otp/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    })
  );
  await page.route(/\/auth\/v1\/verify/, (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        code: 400,
        error_code: "otp_expired",
        msg: "Email OTP has expired",
      }),
    })
  );
}

test.describe("parcours développeur : étape compte", () => {
  test("structure : h1, pilules, champs, progression", async ({ page }) => {
    await gotoFunnel(page);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Crée ton compte"
    );
    await expect(
      page.getByRole("group", { name: "Type de compte" })
    ).toBeVisible();
    await expect(page.getByText("Je suis développeur")).toBeVisible();

    await expect(page.locator("#devreg-email")).toBeVisible();
    await expect(page.locator("#devreg-password")).toBeVisible();
    await expect(page.locator("#devreg-confirm")).toBeVisible();
    await expect(page.getByRole("button", { name: "Créer mon compte" })).toBeVisible();

    const progress = page.getByRole("list", { name: "Progression de l'inscription" });
    await expect(progress).toBeVisible();
    await expect(progress.getByText("Compte")).toBeVisible();
    await expect(progress.getByText("Vérification")).toBeVisible();
  });

  test("validation française, sans appel réseau", async ({ page }) => {
    await gotoFunnel(page);

    await page.getByRole("button", { name: "Créer mon compte" }).click();

    await expect(page.getByText("Adresse email invalide.").first()).toBeVisible();
    await expect(page.getByText("Au moins 8 caractères.").first()).toBeVisible();
    await expect(page.getByText("Confirmez votre mot de passe.").first()).toBeVisible();
    await expect(
      page.getByText(
        "Vous devez accepter les conditions d'utilisation et la politique de confidentialité."
      )
    ).toBeVisible();
    expect(page.url()).toContain("/inscription-developpeur");
  });

  test("mots de passe non conformes + jauge de robustesse", async ({ page }) => {
    await gotoFunnel(page);

    await page.locator("#devreg-email").fill("pas-un-email");
    await page.locator("#devreg-email").blur();
    await expect(page.getByText("Adresse email invalide.")).toBeVisible();

    await page.locator("#devreg-password").fill("Ab1!");
    await expect(page.getByText("Faible")).toBeVisible();

    await page.locator("#devreg-password").fill("Test1234");
    await page.locator("#devreg-confirm").fill("Test1235");
    await page.locator("#devreg-confirm").blur();
    await expect(page.getByText("Les mots de passe ne correspondent pas.")).toBeVisible();
  });

  test("liens de navigation : connexion (retour) et compte client", async ({ page }) => {
    await gotoFunnel(page);

    await expect(
      page.getByRole("main").getByRole("link", { name: "Se connecter" })
    ).toHaveAttribute("href", "/login?next=/inscription-developpeur");
    await expect(
      page.getByRole("link", { name: "Je suis client" })
    ).toHaveAttribute("href", "/signup?role=client");
  });

  test("révélateur de mot de passe", async ({ page }) => {
    await gotoFunnel(page);
    const password = page.locator("#devreg-password");

    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Afficher le mot de passe" }).first().click();
    await expect(password).toHaveAttribute("type", "text");
  });
});

test.describe("parcours développeur : étape vérification email", () => {
  test("signup mocké → code 6 chiffres, envoi auto, erreur FR, reprise", async ({
    page,
  }) => {
    await mockSupabaseAuth(page);
    await gotoFunnel(page);
    await fillAccountForm(page);
    await page.getByRole("button", { name: "Créer mon compte" }).click();

    /* Étape 2 : titre, adresse affichée, 6 cases, bouton Vérifier. */
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Vérifie ton email"
    );
    await expect(
      page.getByText("e2e.dev.funnel@example.com")
    ).toBeVisible();
    for (let i = 0; i < 6; i += 1) {
      await expect(page.locator(`#devreg-otp-${i}`)).toBeVisible();
    }
    const verifyBtn = page.getByRole("button", { name: "Vérifier" });
    await expect(verifyBtn).toBeDisabled();

    /* Le renvoi est en délai après l'envoi automatique. */
    await expect(page.getByRole("button", { name: /Renvoyer dans/ })).toBeDisabled();

    /* Code invalide (verify intercepté → expiré) : message FR + essais. */
    for (let i = 0; i < 6; i += 1) {
      await page.locator(`#devreg-otp-${i}`).fill(String(i));
    }
    await expect(verifyBtn).toBeEnabled();
    await verifyBtn.click();
    await expect(
      page.getByText("Ce code a expiré. Demande un nouveau code.")
    ).toBeVisible();

    /* Reprise après rafraîchissement : on reste sur l'étape vérification. */
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Vérifie ton email"
    );
    await expect(page.getByText("e2e.dev.funnel@example.com")).toBeVisible();
  });

  test("retour à l'étape compte depuis la vérification", async ({ page }) => {
    await mockSupabaseAuth(page);
    await gotoFunnel(page);
    await fillAccountForm(page);
    await page.getByRole("button", { name: "Créer mon compte" }).click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Vérifie ton email"
    );
    await page.getByRole("button", { name: "Retour" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Crée ton compte"
    );
    /* L'email saisi est conservé. */
    await expect(page.locator("#devreg-email")).toHaveValue(
      "e2e.dev.funnel@example.com"
    );
  });
});

test.describe("parcours développeur : responsive", () => {
  test("mobile 390×844 : étape compte sans débordement", async ({ page }) => {
    await gotoFunnel(page, MOBILE);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("mobile 390×844 : étape vérification sans débordement", async ({ page }) => {
    await mockSupabaseAuth(page);
    await gotoFunnel(page, MOBILE);
    await fillAccountForm(page);
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Vérifie ton email"
    );
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
