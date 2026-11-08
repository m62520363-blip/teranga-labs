import * as React from "react";
import {
  Search,
  MessageSquare,
  Wallet,
  Trophy,
  Star,
  ShieldCheck,
} from "lucide-react";
import type { OnboardingStep } from "@/components/onboarding/onboarding-modal";

export const DEVELOPER_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: "Trouvez des projets",
    description:
      "Parcourez les briefs publiés par les clients. Filtrez par catégorie, budget et pays. Débloquez le contact d'un client avec votre quota mensuel.",
    icon: <Search className="size-8" aria-hidden="true" />,
  },
  {
    title: "Échangez dans la messagerie",
    description:
      "Discutez directement avec le client dans la messagerie interne. Envoyez votre devis et proposez votre approche.",
    icon: <MessageSquare className="size-8" aria-hidden="true" />,
  },
  {
    title: "Abonnement et quota",
    description:
      "Avec un abonnement Pro, vous débloquez jusqu'à 80 contacts/mois. Les contacts bonus du classement s'ajoutent à votre quota.",
    icon: <Star className="size-8" aria-hidden="true" />,
  },
  {
    title: "Paiement sécurisé (escrow)",
    description:
      "Le client paie la mission. Les fonds sont bloqués sur la plateforme et libérés vers votre wallet après validation du projet.",
    icon: <ShieldCheck className="size-8" aria-hidden="true" />,
  },
  {
    title: "Classement et récompenses",
    description:
      "Terminez des projets pour monter dans le classement mensuel. Les 3 premiers reçoivent des contacts bonus (10/7/4) chaque mois.",
    icon: <Trophy className="size-8" aria-hidden="true" />,
  },
  {
    title: "Retirez vos gains",
    description:
      "Demandez un retrait depuis votre wallet (minimum 5 000 FCFA) via Wave, Orange Money, Mobicash ou virement bancaire.",
    icon: <Wallet className="size-8" aria-hidden="true" />,
  },
];
