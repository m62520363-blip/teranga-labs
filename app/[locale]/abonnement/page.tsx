import type { Metadata } from "next";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import {
  ProSubscription,
  type ProPrices,
  type ProStatus,
} from "@/components/subscription/pro-subscription";

export const metadata: Metadata = {
  title: "Abonnement PRO",
  description:
    "Découvrez l’abonnement PRO de Devmarket : badge PRO sur votre profil public et dans l’annuaire, payé en Tokens, pour une durée déterminée.",
};

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ ok?: string }>;
};

/**
 * Page publique « Abonnement PRO ».
 *
 * Les prix affichés sont lus dans `get_pro_prices` (app_settings), jamais
 * codés en dur : si un administrateur change le tarif, la page suit sans
 * redéploiement. Le montant en FCFA est dérivé de TOKEN_PRICE_FCFA, la
 * constante déjà utilisée partout ailleurs sur le site.
 *
 * Une seule offre existe réellement : la table `subscriptions` impose
 * `plan in ('pro')`. On ne présente donc PAS de bascule mensuel/annuel ni
 * d'offres multiples, qui seraient des inventions.
 */
export default async function AbonnementPage({ searchParams }: Props) {
  const sp = await searchParams;
  const supabase = await createClient();
  const user = await getCurrentUser();

  // Prix publics : `get_pro_prices` est accordé à anon, donc lisibles sans
  // session. En cas d'absence (Supabase non configuré), on affiche un état
  // explicite plutôt qu'un tarif inventé.
  // Note : PostgrestFilterBuilder n'est pas une Promesse native — on await
  // puis on lit `error`, on n'appelle pas `.catch()`.
  let prices: ProPrices | null = null;
  if (supabase) {
    const { data, error } = await supabase.rpc("get_pro_prices");
    if (!error && data && typeof data === "object") {
      const p = data as Partial<ProPrices>;
      if (typeof p.price_tokens === "number" && typeof p.duration_days === "number") {
        prices = p as ProPrices;
      }
    }
  }

  // Statut, solde et identifiant : uniquement pour un compte connecté.
  // `get_token_balance` exige une session ; l'appel anonyme échouerait.
  let status: ProStatus | null = null;
  let balance: number | null = null;
  let username: string | null = null;

  if (user && supabase) {
    const [statusRes, balanceRes, devRes] = await Promise.all([
      supabase.rpc("get_pro_status"),
      supabase.rpc("get_token_balance"),
      supabase
        .from("developers")
        .select("username")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    const s = statusRes.data as ProStatus | null;
    if (s && typeof s.active === "boolean") status = s;

    // get_token_balance RETURNS integer : la valeur arrive directement.
    const b = balanceRes.data as unknown;
    if (typeof b === "number") balance = b;

    username = devRes.data?.username ?? null;
  }

  return (
    <div className="bg-surface py-10 md:py-16">
      <div className="container-tl">
        <ProSubscription
          prices={prices}
          configured={Boolean(supabase)}
          status={status}
          balance={balance}
          isAuthenticated={Boolean(user)}
          username={username}
          justSubscribed={sp?.ok === "1"}
        />
      </div>
    </div>
  );
}
