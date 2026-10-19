import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { routing } from "@/i18n/routing";

/**
 * Layout de la branche localisée `/[locale]`.
 *
 * La locale est déjà garantie valide par le middleware next-intl (il ne
 * réécrit que vers `/fr/…` ou `/en/…`) : ce contrôle est une double
 * barrière au cas où une requête atteindrait le segment sans passer par le
 * middleware. Le `NextIntlClientProvider` vit dans le layout racine
 * (app/layout.tsx) pour couvrir aussi les pages 404 hors branche `[locale]`.
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return <>{children}</>;
}
