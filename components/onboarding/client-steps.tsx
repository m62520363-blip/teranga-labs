import * as React from "react";
import {
  FileText,
  MessageSquare,
  Star,
  Wallet,
  Search,
  ShieldCheck,
} from "lucide-react";
import type { OnboardingStep } from "@/components/onboarding/onboarding-modal";

export const CLIENT_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: "Publiez votre projet gratuitement",
    description:
      "Décrivez votre besoin en 2 minutes. La publication est 100 % gratuite, sans engagement. Notre assistant IA vous aide à structurer votre brief.",
    icon: <FileText className="size-8" aria-hidden="true" />,
  },
  {
    title: "Recevez des propositions",
    description:
      "Les développeurs abonnés consultent votre brief et vous envoient leur devis dans la messagerie interne. Vous échangez directement avec eux.",
    icon: <MessageSquare className="size-8" aria-hidden="true" />,
  },
  {
    title: "Choisissez votre développeur",
    description:
      "Comparez les propositions, discutez avec les développeurs, puis attribuez le projet à celui qui vous convient le mieux.",
    icon: <Search className="size-8" aria-hidden="true" />,
  },
  {
    title: "Paiement sécurisé (escrow)",
    description:
      "Le paiement est bloqué sur la plateforme jusqu'à la livraison. L'argent n'est libéré au développeur qu'après validation du projet.",
    icon: <ShieldCheck className="size-8" aria-hidden="true" />,
  },
  {
    title: "Mettez en avant votre brief",
    description:
      "Option payante : placez votre brief en tête de liste avec le badge « Mis en avant » pour recevoir plus de propositions rapidement (7/14/30 jours).",
    icon: <Star className="size-8" aria-hidden="true" />,
  },
  {
    title: "Portefeuille et retraits",
    description:
      "En cas d'annulation, le remboursement est automatique vers votre wallet. Vous pouvez retirer vos fonds via Wave, Orange Money ou virement.",
    icon: <Wallet className="size-8" aria-hidden="true" />,
  },
];
