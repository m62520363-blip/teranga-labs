import type { Metadata } from "next";
import Link from "next/link";
import { BriefFilters } from "@/components/brief-filters";
import {
  createClient,
  getCurrentUser,
} from "@/lib/supabase/server";
import { BRIEFS_COLUMNS, BRIEFS_PAGE_SIZE } from "@/lib/briefs-pagination";
import type { PublicRequest } from "@/types/database";

export const metadata: Metadata = {
  title: "Briefs",
  description:
    "Consultez les projets web disponibles au Sénégal et démarrez une discussion privée avec le client pour 1 Token.",
};

export const dynamic = "force-dynamic";

export default async function BriefsPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();

  let briefs: PublicRequest[] = [];
  let total = 0;
  const unlocks: Record<string, { conversation_id?: string; whatsapp?: string }> = {};
  let balance: number | null = null;
  const favorites = new Set<string>();
  // true si le compte n'a jamais débloqué de contact ET n'a jamais consommé
  // l'offre de bienvenue : son 1er contact sera donc gratuit (migration 0033).
  let welcomeContactFree = false;

  if (supabase) {
    const { data, count } = await supabase
      .from("requests")
      .select(BRIEFS_COLUMNS, { count: "exact" })
      .eq("status", "ouvert")
      .eq("hidden", false)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(BRIEFS_PAGE_SIZE);

    briefs = (data ?? []) as PublicRequest[];
    total = count ?? briefs.length;

    if (user) {
      const { data: unlocksData } = await supabase.rpc("get_my_unlocks");
      const rows = Array.isArray(unlocksData) ? unlocksData : [];
      for (const row of rows) {
        const entry = row as { request_id?: string; client_whatsapp?: string };
        if (entry.request_id) {
          unlocks[entry.request_id] = {
            whatsapp: entry.client_whatsapp ?? undefined,
          };
        }
      }
      const { data: conversations } = await supabase
        .from("conversations")
        .select("id, request_id")
        .eq("developer_id", user.id);
      for (const conv of conversations ?? []) {
        if (conv.request_id && unlocks[conv.request_id]) {
          unlocks[conv.request_id] = {
            ...unlocks[conv.request_id],
            conversation_id: conv.id,
          };
        }
      }
      const { data: balanceData } = await supabase.rpc("get_token_balance");
      if (typeof balanceData === "number") balance = balanceData;

      const { data: welcome } = await supabase
        .from("welcome_offer_status")
        .select("has_unlocked_contact, gift_consumed")
        .maybeSingle();
      const w = welcome as { has_unlocked_contact?: boolean; gift_consumed?: boolean } | null;
      welcomeContactFree = w?.has_unlocked_contact === false && w?.gift_consumed === false;

      const { data: myFavorites } = await supabase
        .from("favorites")
        .select("request_id");
      for (const fav of myFavorites ?? []) {
        if (fav.request_id) favorites.add(fav.request_id);
      }
    }
  }

  return (
    <div className="bg-surface py-16 md:py-24">
      <div className="container-tl">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              {total} brief{total > 1 ? "s" : ""} disponible{total > 1 ? "s" : ""} sur le marketplace
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              1 Token ouvre une discussion privée avec le client, en direct.
            </p>
          </div>
          {!user && (
            <Link
              href="/login?mode=signup"
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-foreground px-5 text-sm font-medium text-ink transition-colors outline-none hover:bg-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              Créer un compte développeur
            </Link>
          )}
        </div>

        <h2 className="mt-10 text-sm font-semibold tracking-tight">
            Parcourir les briefs
          </h2>
        <div className="mt-4">
          <BriefFilters
            briefs={briefs}
            total={total}
            user={user ? { id: user.id } : null}
            balance={balance}
            unlocks={unlocks}
            favorites={favorites}
            welcomeContactFree={welcomeContactFree}
          />
        </div>
      </div>
    </div>
  );
}