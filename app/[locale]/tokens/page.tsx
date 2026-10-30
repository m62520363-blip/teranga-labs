import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

export const metadata: Metadata = {
  title: "Nos abonnements",
  description:
    "Découvrez les formules d’abonnement développeur Devmarket : Pro, Pro Max et Agence.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * L'ancienne route /tokens redirige désormais vers /abonnement
 * (refonte du modèle économique : abonnements développeurs avec quotas mensuels).
 */
export default async function TokensRedirectPage() {
  const locale = await getLocale();
  redirect({ href: "/abonnement", locale });
}
