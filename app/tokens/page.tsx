import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { TokenCard } from "@/components/token-card";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/empty-state";
import { Scene3D } from "@/components/landing/scene-3d";

export const metadata: Metadata = {
  title: "Tokens",
  description:
    "Commandez vos Tokens en ligne (carte, Wave, Orange Money) et débloquez les coordonnées des clients qui cherchent un développeur.",
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
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            Commandez vos Tokens
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Débloquez les coordonnées des clients qui cherchent un développeur.
          </p>
        </div>

        <Scene3D variant="tokens" className="mt-6" />

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
          <div className="rounded-2xl border border-hairline bg-card p-5 shadow-sm">
            <h2 className="text-[15px] font-semibold tracking-tight">
              Moyens de paiement
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Réglez en ligne sur une page sécurisée : vos Tokens sont crédités
              automatiquement dès confirmation du paiement, sans attendre.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3 text-sm">
                <span className="font-medium">Wave</span>
                <span className="text-xs text-muted-foreground">Mobile money</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3 text-sm">
                <span className="font-medium">Orange Money</span>
                <span className="text-xs text-muted-foreground">Mobile money</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3 text-sm">
                <span className="font-medium">Carte bancaire</span>
                <span className="text-xs text-muted-foreground">Visa, Mastercard</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3 text-sm">
                <span className="font-medium">Max It</span>
                <span className="text-xs text-muted-foreground">Mobile money</span>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Le règlement passe par PayDunya, prestataire de paiement agréé
              au Sénégal et dans la sous-région. Vous recevez une facture PDF
              par email, et vos Tokens sont crédités dès que le paiement est
              confirmé.
            </p>
            <p className="mt-4 rounded-xl border border-hairline bg-muted/60 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">
                Remboursement.
              </span>{" "}
              Un Token consommé sur un contact n’est pas remboursable. En cas de
              contact frauduleux ou de brief fictif, signalez-le dans les{" "}
              <strong>48 heures</strong> suivant le déblocage : l’équipe vérifie
              la messagerie et rembourse en Tokens si le litige est confirmé.
            </p>
          </div>
        </div>

        <div className="mx-auto mt-8 max-w-2xl">
          <div className="rounded-2xl border border-hairline bg-card p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
                <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-[15px] font-semibold tracking-tight">
                  Des Tokens crédités après confirmation de paiement
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Un paiement n’est jamais simulé : les Tokens sont crédités
                  qu’après réception effective de l’argent, automatiquement dès
                  confirmation du règlement.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}