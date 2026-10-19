import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

/**
 * Configuration de requête next-intl : fournit les messages adaptés à la
 * locale courante aux Server Components.
 *
 * La locale est fournie par le middleware next-intl (segment `[locale]` ou
 * en-tête `x-next-intl-locale`) via `requestLocale` — une Promise dans
 * next-intl v4 (l'ancien `locale` reste undefined tant qu'on n'a pas passé
 * d'override explicite). Si elle est absente ou invalide, on retombe sur la
 * locale par défaut (fr) plutôt que de casser.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const resolved = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale: resolved,
    messages: (await import(`../messages/${resolved}.json`)).default,
  };
});
