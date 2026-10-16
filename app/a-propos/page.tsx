import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Coins, FileSearch, ShieldCheck } from "lucide-react";
import { TOKEN_RULE } from "@/lib/formatting";
import { Scene3D } from "@/components/landing/scene-3d";

export const metadata: Metadata = {
  title: "À propos",
  description:
    "TERANGA LABS est le marketplace inversé d'Afrique de l'Ouest : les clients publient le brief de leur site web moyennant 1 Token, les développeurs débloquent le contact avec 1 Token.",
};

const values = [
  {
    icon: FileSearch,
    title: "Le client gagne du temps",
    text: "Publier un brief prend 2 minutes et coûte 1 Token. Seuls les développeurs sérieux — ceux qui ont investi un Token — le contactent.",
  },
  {
    icon: Coins,
    title: "Le développeur paie juste",
    text: `${TOKEN_RULE} = 1 contact. Vous ne payez que pour les briefs qui vous intéressent vraiment, sans commission sur le projet.`,
  },
  {
    icon: ShieldCheck,
    title: "Un échange direct",
    text: "Messagerie interne, zéro intermédiaire. Le client et le développeur décident ensemble, en toute confidentialité.",
  },
];

export default function AProposPage() {
  return (
    <div className="bg-surface py-16 md:py-24">
      <div className="container-tl">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            À propos de TERANGA LABS
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">On ne vend pas des sites. On vend l’accès aux clients qui veulent des sites.</span>{" "}
            TERANGA LABS est le marketplace inversé d&apos;Afrique de
            l&apos;Ouest : une boutique à Thiès, un resto à Dakar, une école à
            Abidjan publient le brief de leur projet (1 Token), et les
            développeurs sérieux viennent vers eux.
          </p>

          <div className="mt-10 flex justify-center">
            <Scene3D variant="marketplace" />
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {values.map((value) => (
              <div
                key={value.title}
                className="rounded-2xl border border-hairline bg-card p-6"
              >
                <value.icon className="size-5 text-primary" aria-hidden="true" />
                <h2 className="mt-4 font-semibold tracking-tight">{value.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {value.text}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-12 rounded-2xl bg-muted p-8 text-white sm:p-10">
            <h2 className="text-xl font-semibold tracking-tight">
              Prêt à essayer ?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/70">
              Publiez votre premier brief (1 Token), ou découvrez les briefs
              qui cherchent déjà un développeur.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/poster" className="btn btn-invert">
                Publier mon brief
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link href="/briefs" className="btn btn-invert">
                Voir les briefs
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}