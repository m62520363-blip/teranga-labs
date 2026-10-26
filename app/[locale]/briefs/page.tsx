import type { Metadata } from "next";
import Link from "next/link";
import { Plus, UserRound } from "lucide-react";
import { BriefFilters } from "@/components/brief-filters";
import {
  createClient,
  getCurrentUser,
} from "@/lib/supabase/server";
import { BRIEFS_COLUMNS, BRIEFS_PAGE_SIZE } from "@/lib/briefs-pagination";
import { findRegionByPlace } from "@/lib/geography";
import type { PublicRequest } from "@/types/database";

export const metadata: Metadata = {
  title: "Projets",
  description:
    "Consultez les projets web disponibles en Afrique de l'Ouest francophone et démarrez une discussion privée avec le client pour 1 Token.",
};

export const dynamic = "force-dynamic";

export default async function BriefsPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string; region?: string }>;
}) {
  const sp = await searchParams;
  // Deep-links géographiques (pages /pays et /ville) : ?country=SN&region=Dakar.
  const initialCountry =
    typeof sp.country === "string" && sp.country.trim()
      ? sp.country.trim().toUpperCase().slice(0, 3)
      : "";
  const initialRegionName =
    typeof sp.region === "string" && sp.region.trim() ? sp.region.trim() : "";
  const resolvedRegion = findRegionByPlace(initialRegionName);
  const initialRegion = resolvedRegion ? resolvedRegion.code : "";

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
    <div className="bg-surface py-10 md:py-14">
      <div className="container-tl">
        {/* En-tête façon Codeur : compte, promesse et double CTA. */}
        <section className="relative overflow-hidden rounded-3xl border border-hairline bg-card p-6 sm:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_140%_at_0%_0%,color-mix(in_srgb,var(--primary)_14%,transparent),transparent_55%)]"
          />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                Projets ouverts
              </p>
              <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight md:text-3xl">
                {total} projet{total > 1 ? "s" : ""} qui cherche{total > 1 ? "nt" : ""} un
                développeur
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Publication gratuite côté client, devis gratuits. 1 Token ouvre la
                discussion privée avec le client — aucun commission sur le projet.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/poster"
                className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground outline-none transition-colors hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <Plus className="size-4" aria-hidden="true" />
                Publier un projet
              </Link>
              {!user && (
                <Link
                  href="/inscription-developpeur"
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-hairline bg-background/60 px-5 text-sm font-medium outline-none transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <UserRound className="size-4" aria-hidden="true" />
                  Devenir développeur
                </Link>
              )}
            </div>
          </div>
        </section>

        <div className="mt-8">
          <BriefFilters
            briefs={briefs}
            total={total}
            user={user ? { id: user.id } : null}
            balance={balance}
            unlocks={unlocks}
            favorites={favorites}
            initialCountry={initialCountry}
            initialRegion={initialRegion}
            welcomeContactFree={welcomeContactFree}
          />
        </div>
      </div>
    </div>
  );
}