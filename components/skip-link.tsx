"use client";

import { useTranslations } from "next-intl";

/**
 * Lien d'évitement (WCAG 2.4.1) : premier élément focusable de la page,
 * invisible tant qu'il n'a pas le focus. Pointe vers `#main` (le `<main>`
 * de SiteShell porte déjà cet id + tabIndex={-1}).
 */
export function SkipLink() {
  const t = useTranslations("Nav");
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-ink focus:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
    >
      {t("skipToContent")}
    </a>
  );
}
