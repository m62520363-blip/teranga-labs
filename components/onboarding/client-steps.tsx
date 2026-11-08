import * as React from "react";
import {
  FileText,
  MessageSquare,
  Users,
  ShieldCheck,
  Star,
  Wallet,
  Rocket,
} from "lucide-react";
import type { OnboardingStep } from "@/components/onboarding/onboarding-modal";

export const CLIENT_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: "1. Publiez votre projet (gratuit)",
    description:
      "Décrivez votre besoin en 2 minutes. La publication est 100 % gratuite, sans engagement. Notre assistant IA vous aide à structurer votre brief si vous le souhaitez.",
    icon: <FileText className="size-8" aria-hidden="true" />,
  },
  {
    title: "2. Recevez des propositions",
    description:
      "Les développeurs abonnés consultent votre brief et vous envoient leur devis dans la messagerie interne. Vous échangez directement avec eux, sans commission.",
    icon: <MessageSquare className="size-8" aria-hidden="true" />,
  },
  {
    title: "3. Comparez et choisissez",
    description:
      "Comparez les propositions, discutez avec les développeurs, puis attribuez le projet à celui qui vous convient le mieux. Vous gardez le contrôle total.",
    icon: <Users className="size-8" aria-hidden="true" />,
  },
  {
    title: "4. Paiement sécurisé (escrow)",
    description:
      "Le paiement est bloqué sur la plateforme jusqu'à la livraison. L'argent n'est libéré au développeur qu'après votre validation du projet. En cas d'annulation, remboursement automatique.",
    icon: <ShieldCheck className="size-8" aria-hidden="true" />,
  },
  {
    title: "5. Mettez en avant votre brief (optionnel)",
    description:
      "Placez votre brief en tête de liste avec le badge « Mis en avant » pour recevoir plus de propositions rapidement. 7 jours = 2 500 FCFA, 14 jours = 4 500 FCFA, 30 jours = 8 000 FCFA.",
    icon: <Star className="size-8" aria-hidden="true" />,
  },
  {
    title: "6. Portefeuille et retraits",
    description:
      "En cas d'annulation, le remboursement est automatique vers votre wallet. Vous pouvez retirer vos fonds via Wave, Orange Money, Mobicash ou virement bancaire (min. 5 000 FCFA).",
    icon: <Wallet className="size-8" aria-hidden="true" />,
  },
  {
    title: "7. C'est parti !",
    description:
      "Cliquez sur « Publier un projet » pour commencer. Votre premier projet est gratuit et sans engagement.",
    icon: <Rocket className="size-8" aria-hidden="true" />,
  },
];
