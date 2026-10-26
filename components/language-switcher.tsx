"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "cn";

/* --------------------------- SWITCHER DE LANGUE --------------------------- */
/* Sélecteur FR/EN compact : la langue courante est une pastille active,
   l'autre langue est un lien qui préserve la page courante (next-intl
   préfixe automatiquement en `/en` ; `/fr/…` est normalisé par le
   middleware en `as-needed`).

   La bascule s'exprime en navigation COMPLÈTE : le NextIntlClientProvider
   vit dans le layout racine (couverture des 404 hors branche `[locale]`)
   et le layout racine ne se re-rend pas lors d'une navigation client —
   seul un rechargement serveur applique la nouvelle locale partout
   (navbar, footer, sections client).

   Partagé : navbar publique + shells de l'espace client et
   développeur (la navbar noire n'est plus affichée dans ces espaces). */

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("Nav");
  const switchLocale = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    window.location.assign(event.currentTarget.href);
  };
  const base =
    "inline-flex min-h-7 min-w-7 items-center justify-center px-2 py-1 text-[11px] font-semibold leading-none tracking-wide outline-none transition-colors";
  const currentClass = cn(base, "bg-primary text-primary-foreground");
  const linkClass = cn(
    base,
    "rounded-full text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
  );
  return (
    <div
      role="group"
      aria-label={t("langGroup")}
      className="flex w-fit items-center rounded-full border border-white/10 bg-white/[0.05] p-0.5"
    >
      {locale === "fr" ? (
        <span lang="fr" aria-current="true" className={currentClass}>
          FR
        </span>
      ) : (
        <Link
          href={pathname}
          locale="fr"
          lang="fr"
          hrefLang="fr"
          aria-label={t("langToFr")}
          className={linkClass}
          onClick={switchLocale}
        >
          FR
        </Link>
      )}
      {locale === "en" ? (
        <span lang="en" aria-current="true" className={currentClass}>
          EN
        </span>
      ) : (
        <Link
          href={pathname}
          locale="en"
          lang="en"
          hrefLang="en"
          aria-label={t("langToEn")}
          className={linkClass}
          onClick={switchLocale}
        >
          EN
        </Link>
      )}
    </div>
  );
}
