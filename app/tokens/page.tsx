import type { Metadata } from "next";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { TokenCard } from "@/components/token-card";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = {
  title: "Tokens",
  description:
    "Rechargez vos Tokens et débloquez les coordonnées des clients qui cherchent un développeur.",
};

export const dynamic = "force-dynamic";

function PaymentNotice({ status }: { status: string | null }) {
  if (!status) return null;

  if (status === "paid") {
    return (
      <div className="mx-auto mt-8 flex max-w-2xl items-start gap-3 rounded-2xl border border-[#3DD68C]/25 bg-[#122A1C] p-4 text-sm">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#3DD68C]" aria-hidden="true" />
        <div>
          <p className="font-semibold text-foreground">Paiement confirmé</p>
          <p className="mt-0.5 text-muted-foreground">
            Vos Tokens ont été crédités automatiquement. Ils apparaissent dans
            votre tableau de bord.
          </p>
        </div>
      </div>
    );
  }
  if (status === "pending") {
    return (
      <div className="mx-auto mt-8 flex max-w-2xl items-start gap-3 rounded-2xl border border-[#E86A2C]/30 bg-[#2A1A10] p-4 text-sm">
        <Clock className="mt-0.5 size-5 shrink-0 text-[#E86A2C]" aria-hidden="true" />
        <div>
          <p className="font-semibold text-foreground">Paiement en cours de confirmation</p>
          <p className="mt-0.5 text-muted-foreground">
            Le paiement est généralement confirmé en quelques instants.
            Rechargez cette page dans une minute pour vérifier.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto mt-8 flex max-w-2xl items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm">
      <XCircle className="mt-0.5 size-5 shrink-0 text-red-600" aria-hidden="true" />
      <div>
        <p className="font-semibold text-foreground">
          Paiement non confirmé ou annulé
        </p>
        <p className="mt-0.5 text-muted-foreground">
          Aucun Token n’a été débité. Si vous pensez avoir payé, contactez-nous
          quelques minutes plus tard : le webhook relance automatiquement en cas
          de silence.
        </p>
      </div>
    </div>
  );
}

export default async function TokensPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string }>;
}) {
  const { intent } = await searchParams;

  const supabase = await createClient();
  const [packagesRes, intentRes] = await Promise.all([
    supabase
      ? supabase
          .from("token_packages")
          .select("id, name, tokens, price_fcfa, popular")
          .order("price_fcfa", { ascending: true })
      : Promise.resolve({ data: null }),
    supabase && intent
      ? supabase
          .from("payment_intents")
          .select("status")
          .eq("id", intent)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const packages = packagesRes.data ?? [];
  const paymentStatus = (intentRes.data?.status as string | undefined) ?? null;

  return (
    <div className="bg-[#0F0F0F] py-16 md:py-24">
      <div className="container-tl">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Rechargez vos Tokens
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Débloquez les coordonnées des clients qui cherchent un développeur.
          </p>
        </div>

        <PaymentNotice status={paymentStatus} />

        {packages.length > 0 ? (
          <div className="mx-auto mt-14 grid max-w-4xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {packages.map((pkg) => (
              <TokenCard key={pkg.id} pkg={pkg} />
            ))}
          </div>
        ) : (
          <div className="mx-auto mt-14 max-w-2xl">
            <EmptyState
              title="Packs indisponibles"
              description="Connectez Supabase et appliquez les migrations pour charger les packs de Tokens."
            />
          </div>
        )}

        <div className="mx-auto mt-8 max-w-2xl">
          <div className="rounded-2xl border border-[#2A2A2A] bg-[#141414] p-5 shadow-sm">
            <h2 className="text-[15px] font-semibold tracking-tight">
              Moyens de paiement
            </h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-xl bg-[#1E1E1E] px-4 py-3 text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <span className="size-2 rounded-full bg-[#3DD68C]" aria-hidden="true" />
                  Wave
                </span>
                <span className="text-xs text-muted-foreground">Disponible</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-[#1E1E1E] px-4 py-3 text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <span className="size-2 rounded-full bg-[#E86A2C]" aria-hidden="true" />
                  Max It
                </span>
                <span className="text-xs font-medium text-[#E86A2C]">Hors service</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-8 max-w-2xl">
          <div className="rounded-2xl border border-[#2A2A2A] bg-[#141414] p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#2A1A10]">
                <CheckCircle2 className="size-4 text-[#E86A2C]" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-[15px] font-semibold tracking-tight">
                  Des Tokens crédités après confirmation serveur
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Un paiement n’est jamais simulé : les Tokens ne sont crédités
                  qu’après validation réelle du paiement par nos serveurs
                  (webhook signé Wave).
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}