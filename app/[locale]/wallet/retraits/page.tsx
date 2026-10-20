import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guards";
import { WithdrawalForm } from "@/components/wallet/withdrawal-form";

export const metadata: Metadata = {
  title: "Demander un retrait",
  description: "Demandez le retrait de vos revenus.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function WithdrawalPage() {
  await requireUser();

  return (
    <div className="bg-surface py-16 md:py-24">
      <div className="container-tl">
        <div className="mx-auto max-w-xl">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            Demander un retrait
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Indiquez le montant et vos coordonnées. Votre demande sera traitée par notre équipe.
          </p>
          <div className="mt-8">
            <WithdrawalForm />
          </div>
        </div>
      </div>
    </div>
  );
}
