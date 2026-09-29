import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  HelpCircle,
  MessageCircle,
  UserPlus,
  Wallet,
} from "lucide-react";
import { FaqItem } from "@/components/faq-item";
import { Reveal } from "@/components/reveal";
import { FAQS } from "@/components/landing/content";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Toutes les réponses sur TERANGA LABS : prix des Tokens, publication d’un brief, rôle du développeur et fonctionnement du marketplace inversé.",
};

const groups = [
  {
    icon: UserPlus,
    title: "Pour les clients",
    text: "Publier un brief coûte 1 Token et prend 2 minutes. Seuls les développeurs sérieux — ceux qui ont débloqué votre contact avec 1 Token — peuvent vous écrire.",
    href: "/poster",
    cta: "Publier un brief",
  },
  {
    icon: Wallet,
    title: "Pour les développeurs",
    text: "Chaque brief vous montre le budget et la région. Vous investissez 1 Token pour débloquer le contact et ouvrir la discussion privée. Zéro commission sur le projet.",
    href: "/briefs",
    cta: "Voir les briefs",
  },
  {
    icon: MessageCircle,
    title: "Discussions privées",
    text: "Tout se passe dans la messagerie interne : devis, détails du projet, questions. Votre WhatsApp reste masqué tant que vous n’acceptez pas d’échanger.",
    href: "/login",
    cta: "Créer un compte",
  },
];

export default function FaqPage() {
  return (
    <div className="bg-surface py-16 md:py-24">
      <div className="container-tl">
        <div className="mx-auto max-w-3xl">
          <span className="chip gap-2 bg-[#141414]/85 border-hairline backdrop-blur">
            <HelpCircle className="size-3.5 text-primary" aria-hidden="true" />
            FAQ
          </span>
          <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Questions fréquentes
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
            Tout ce qu’il faut savoir avant de publier votre premier brief, ou
            de débloquer votre premier contact en tant que développeur.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-3xl">
          <div className="grid gap-4 sm:grid-cols-3">
            {groups.map((group) => (
              <Reveal key={group.title}>
                <div className="card-elevate flex h-full flex-col rounded-2xl border border-hairline bg-[#141414] p-5">
                  <group.icon
                    className="size-5 text-primary"
                    aria-hidden="true"
                  />
                  <h2 className="mt-3 font-semibold tracking-tight">
                    {group.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {group.text}
                  </p>
                  <Link
                    href={group.href}
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-[#f59348]"
                  >
                    {group.cta}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-12">
            <div className="rounded-2xl border border-hairline bg-[#141414] p-6 sm:p-8">
              {FAQS.map((f) => (
                <FaqItem key={f.q} question={f.q} answer={f.a} />
              ))}
            </div>
          </Reveal>

          <div className="mt-12 flex flex-col items-start justify-between gap-4 rounded-2xl bg-[#1C1C1C] p-6 sm:flex-row sm:items-center sm:p-8">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Vous n’avez pas trouvé votre réponse ?
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-white/70">
                Écrivez-nous, on répond vite à chaque demande.
              </p>
            </div>
            <Link href="/contact" className="btn btn-invert">
              Contacter l’équipe
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}