import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

export const metadata: Metadata = {
  title: "Tokens",
  description:
    "Rechargez vos Tokens depuis votre wallet pour publier un brief ou débloquer un contact.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * L'achat de Tokens est forcé par le wallet (point de recharge unique) :
 * /tokens ne fait que rediriger vers la section packs de /wallet.
 */
export default async function TokensPage() {
  const locale = await getLocale();
  redirect({ href: "/wallet#acheter-tokens", locale });
}
