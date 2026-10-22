export { cn } from "cn";

export function absoluteUrl(path: string) {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000");
  return new URL(path, base);
}

/**
 * Construit les `alternates` (canonical + hreflang) pour une page localisée.
 *
 * `pathname` est le chemin public tel que reçu par le middleware, prefixe
 * `/en` pour l'anglais et sans prefixe pour le francais (locale par defaut).
 * On en derive les deux variantes de langue ainsi qu'un `x-default` pointant
 * vers la version francaise.
 */
export function buildAlternates(pathname: string) {
  const isEn = pathname === "/en" || pathname.startsWith("/en/");
  const basePath = isEn ? pathname.slice("/en".length) || "/" : pathname;
  const enPath = basePath === "/" ? "/en" : `/en${basePath}`;
  return {
    canonical: absoluteUrl(pathname).toString(),
    languages: {
      en: absoluteUrl(enPath).toString(),
      fr: absoluteUrl(basePath).toString(),
      "x-default": absoluteUrl(basePath).toString(),
    },
  };
}