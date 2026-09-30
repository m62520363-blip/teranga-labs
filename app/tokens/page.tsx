import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { TokenCard } from "@/components/token-card";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = {
  title: "Tokens",
  description:
    "Rechargez vos Tokens et débloquez les coordonnées des clients qui cherchent un développeur.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function TokensPage() {
  const supabase = await createClient();

  const { data: packages } = supabase
    ? await supabase
        .from("token_packages")
        .select("id, name, tokens, price_fcfa, popular")
        .order("price_fcfa", { ascending: true })
    : { data: null };

  return (
    <div className="bg-surface py-16 md:py-24">
      <div className="container-tl">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Rechargez vos Tokens
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Débloquez les coordonnées des clients qui cherchent un développeur.
          </p>
        </div>

        {packages && packages.length > 0 ? (
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
          <div className="rounded-2xl border border-hairline bg-[#141414] p-5 shadow-sm">
            <h2 className="text-[15px] font-semibold tracking-tight">
              Moyens de paiement
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              L’achat se fait par commande : créez une commande, payez sur votre
              mobile money habituel, notre équipe confirme et crédite vos
              Tokens. Le paiement en ligne automatique est en préparation.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-xl bg-[#1E1E1E] px-4 py-3 text-sm">
                <span className="font-medium">Wave</span>
                <span className="text-xs text-muted-foreground">Bientôt</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-[#1E1E1E] px-4 py-3 text-sm">
                <span className="font-medium">Max It</span>
                <span className="text-xs text-muted-foreground">Bientôt</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-8 max-w-2xl">
          <div className="rounded-2xl border border-hairline bg-[#141414] p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#2A1A10]">
                <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-[15px] font-semibold tracking-tight">
                  Des Tokens crédités après confirmation de paiement
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Un paiement n’est jamais simulé : les Tokens ne sont crédités
                  qu’après réception effective de l’argent par notre équipe,
                  qui valide manuellement chaque commande.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}