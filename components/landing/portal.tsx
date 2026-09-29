import Link from "next/link";
import {
  ArrowRight,
  Check,
  Laptop,
  MessageSquare,
  ShieldCheck,
  UserRound,
  Wallet,
} from "lucide-react";
import { Section, SectionHeader } from "@/components/landing/section";

const CLIENT_POINTS = [
  "Publiez votre brief en 5 minutes pour 1 Token (2 500 FCFA)",
  "Recevez les propositions des développeurs vérifiés",
  "Discutez en temps réel sans exposer votre WhatsApp",
  "Suivez l’avancement et laissez un avis après livraison",
];

const DEV_POINTS = [
  "Consultez les briefs réels avec budget, région et cahier des charges",
  "Débloquez le contact du client avec 1 Token",
  "Envoyez une proposition chiffrée et discutez en direct",
  "Construisez votre réputation : avis, badge vérifié, carte de visite",
];

const SENEGAL_POINTS = [
  {
    icon: Wallet,
    title: "Paiement en FCFA",
    text: "Commandes traitées par l’équipe, réglées sur Wave ou Max It. Paiement en ligne en préparation.",
  },
  {
    icon: MessageSquare,
    title: "Votre WhatsApp reste privé",
    text: "La messagerie est intégrée à la plateforme : le contact ne s’ouvre qu’au développeur qui investit 1 Token.",
  },
  {
    icon: ShieldCheck,
    title: "Confiance vérifiée",
    text: "Profils validés, avis réels après livraison et remboursement si le contact est inactif.",
  },
];

export function PortalSection() {
  return (
    <Section ariaLabel="Choisir son univers">
      <SectionHeader
        eyebrow="Deux univers, une plateforme"
        title="Client ou développeur : chacun son parcours"
        lead="Côté client, votre projet trouve le bon profil. Côté développeur, les missions sérieuses viennent à vous. Même monnaie : 1 Token = 2 500 FCFA."
      />

      <div className="mt-14 grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col rounded-2xl border border-hairline bg-[#141414] p-8 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.8)]">
          <div className="flex items-center justify-between gap-3">
            <span className="chip gap-2 bg-[#1C1C1C]/90 border-hairline">
              <UserRound className="size-4 text-primary" aria-hidden="true" />
              Univers client
            </span>
            <span className="badge badge-muted">Gratuit d’inscription</span>
          </div>

          <h3 className="mt-6 text-2xl font-semibold tracking-tight">
            Je cherche un développeur
          </h3>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Décrivez votre besoin : le bon développeur vient vers vous, pas
            l’inverse.
          </p>

          <ul className="mt-7 space-y-3">
            {CLIENT_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                {point}
              </li>
            ))}
          </ul>

          <div className="mt-9 flex flex-wrap items-center gap-3 pt-1">
            <Link href="/poster" className="btn btn-primary">
              Publier mon brief
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link href="/login?mode=signup" className="btn btn-ghost">
              Créer un compte client
            </Link>
          </div>
        </div>

        <div className="flex flex-col rounded-2xl border border-hairline bg-[#141414] p-8 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.8)]">
          <div className="flex items-center justify-between gap-3">
            <span className="chip gap-2 bg-[#1C1C1C]/90 border-hairline">
              <Laptop className="size-4 text-primary" aria-hidden="true" />
              Univers développeur
            </span>
            <span className="badge badge-muted">1 Token par contact</span>
          </div>

          <h3 className="mt-6 text-2xl font-semibold tracking-tight">
            Je cherche des missions
          </h3>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Des briefs payants vérifiés, rapprochés de votre profil et de votre
            région.
          </p>

          <ul className="mt-7 space-y-3">
            {DEV_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                {point}
              </li>
            ))}
          </ul>

          <div className="mt-9 flex flex-wrap items-center gap-3 pt-1">
            <Link href="/briefs" className="btn btn-secondary">
              Voir les missions
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link href="/login?mode=signup" className="btn btn-ghost">
              Créer un compte développeur
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-14 rounded-2xl border border-hairline bg-gradient-to-br from-[#141414] to-surface p-8 md:p-10">
        <h3 className="text-center text-lg font-semibold tracking-tight md:text-xl">
          Pourquoi Teranga Labs au Sénégal
        </h3>
        <div className="mt-8 grid gap-8 md:grid-cols-3">
          {SENEGAL_POINTS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex flex-col items-center text-center">
              <span className="flex size-12 items-center justify-center rounded-xl border border-hairline bg-[#1C1C1C]">
                <Icon className="size-5 text-primary" aria-hidden="true" />
              </span>
              <span className="mt-4 text-sm font-semibold tracking-tight">{title}</span>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                {text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}