import { defineRouting } from "next-intl/routing";

/**
 * Routage i18n du site public.
 *
 * - Français = locale par défaut, SANS préfixe d'URL (les URLs FR existantes
 *   ne bougent pas : `/briefs` reste `/briefs`, aucune redirection 301).
 * - Anglais = préfixe `/en` (`/en/briefs`).
 *
 * `localePrefix: "as-needed"` est exactement cette stratégie : le préfixe
 * n'apparaît que pour les locales non-défaut.
 */
export const routing = defineRouting({
  locales: ["fr", "en"],
  defaultLocale: "fr",
  localePrefix: "as-needed",
  // DÉTECTION DÉSACTIVÉE volontairement : avec `true` (la valeur par
  // défaut de next-intl), une requête sans préfixe serait négociée via
  // le cookie NEXT_LOCALE puis l'en-tête Accept-Language. Un navigateur
  // internationalisé en `en-US` (ex. Playwright) redirigerait alors
  // `/briefs` → `/en/briefs` et ferait basculer tout le site en anglais.
  // Ici, seule la présence du préfixe `/en` change de langue : les URLs
  // FR sans préfixe restent toujours en français, sans exception.
  localeDetection: false,
});

export type AppLocale = (typeof routing.locales)[number];
