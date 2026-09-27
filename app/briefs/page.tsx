import type { Metadata } from "next";
import Link from "next/link";
import { BriefFilters } from "@/components/brief-filters";
import {
  createClient,
  getCurrentUser,
} from "@/lib/supabase/server";
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
  const unlocks: Record<string, { conversation_id?: string; whatsapp?: string }> = {};
  let balance: number | null = null;

  if (supabase) {
    const { data } = await supabase
      .from("requests")
      .select(
        "id, client_name, client_city, project_type, budget, description, status, hidden, budget_verified, demo, created_at"
      )
      .eq("status", "ouvert")
      .eq("hidden", false)
      .order("created_at", { ascending: false })
      .limit(50);

    briefs = (data ?? []) as PublicRequest[];

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
        if (unlocks[conv.request_id]) {
          unlocks[conv.request_id] = {
            ...unlocks[conv.request_id],
            conversation_id: conv.id,
          };
        }
      }
      const { data: balanceData } = await supabase.rpc("get_token_balance");
      if (typeof balanceData === "number") balance = balanceData;
    }
  }

  return (
    <div className="bg-[#0F0F0F] py-16 md:py-24">
      <div className="container-tl">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              {briefs.length} briefs disponibles au Sénégal
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              1 Token ouvre une discussion privée avec le client, en direct.
            </p>
          </div>
          {!user && (
            <Link
              href="/login?mode=signup"
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-[#F2F2F2] px-5 text-sm font-medium text-[#0D0D0D] transition-colors outline-none hover:bg-[#EBEBEB] focus-visible:ring-2 focus-visible:ring-[#E86A2C]/50"
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
            user={user ? { id: user.id } : null}
            balance={balance}
            unlocks={unlocks}
          />
        </div>
      </div>
    </div>
  );
}