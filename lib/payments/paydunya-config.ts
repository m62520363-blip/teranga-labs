export type PaydunyaMode = "test" | "live";

export type PaydunyaConfig = {
  masterKey: string;
  privateKey: string;
  publicKey: string;
  token: string;
  mode: PaydunyaMode;
  checkoutCreateUrl: string;
  checkoutConfirmBaseUrl: string;
};

const CHECKOUT_BASE = "https://app.paydunya.com";

/**
 * Résout la configuration PayDunya depuis les variables d'environnement.
 *
 * Noms conformes à la nomenclature documentée par PayDunya (SDK NodeJS,
 * section « Basic configuration »). Les clés de test et de production
 * sont séparées par le suffixe `_TEST` : sans cela, basculer en live
 * obligerait à écraser les mêmes variables, avec un risque de MIXAGE
 * (une MasterKey de test avec une PrivateKey live) qui ne serait détecté
 * qu'à l'appel de l'API.
 *
 * Aucune valeur par défaut pour les clés : un secret manquant doit
 * rendre le module simplement « non configuré », jamais une chaîne vide
 * envoyée à l'API.
 */
export function getPaydunyaConfig(): PaydunyaConfig {
  const isTest = process.env.PAYDUNYA_MODE !== "live";

  const masterKey = isTest
    ? process.env.PAYDUNYA_TEST_MASTER_KEY ?? process.env.PAYDUNYA_MASTER_KEY ?? ""
    : process.env.PAYDUNYA_MASTER_KEY ?? "";
  const privateKey = isTest
    ? process.env.PAYDUNYA_TEST_PRIVATE_KEY ?? process.env.PAYDUNYA_PRIVATE_KEY ?? ""
    : process.env.PAYDUNYA_PRIVATE_KEY ?? "";
  const publicKey = isTest
    ? process.env.PAYDUNYA_TEST_PUBLIC_KEY ?? process.env.PAYDUNYA_PUBLIC_KEY ?? ""
    : process.env.PAYDUNYA_PUBLIC_KEY ?? "";
  const token = isTest
    ? process.env.PAYDUNYA_TEST_TOKEN ?? process.env.PAYDUNYA_TOKEN ?? ""
    : process.env.PAYDUNYA_TOKEN ?? "";

  return {
    masterKey,
    privateKey,
    publicKey,
    token,
    mode: isTest ? "test" : "live",
    // Le segment `/sandbox-api/` n'existe qu'en test.
    checkoutCreateUrl: `${CHECKOUT_BASE}/${
      isTest ? "sandbox-api" : "api"
    }/v1/checkout-invoice/create`,
    checkoutConfirmBaseUrl: `${CHECKOUT_BASE}/${
      isTest ? "sandbox-api" : "api"
    }/v1/checkout-invoice/confirm`,
  };
}

export function isPaydunyaConfigured(): boolean {
  const config = getPaydunyaConfig();
  return Boolean(config.masterKey && config.privateKey && config.token);
}
