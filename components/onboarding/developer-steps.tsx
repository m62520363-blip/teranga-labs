import * as React from "react";
import {
  Search,
  MessageSquare,
  Star,
  ShieldCheck,
  Trophy,
  Wallet,
  Rocket,
  UserCircle,
} from "lucide-react";
import type { OnboardingStep } from "@/components/onboarding/onboarding-modal";

export const DEVELOPER_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: "1. Complétez votre profil",
    description:
      "Ajoutez votre photo, vos compétences, votre expérience et votre portfolio. Un profil complet à 100 % vous rend visible dans le classement et attire plus de clients.",
    icon: <UserCircle className="size-8" aria-hidden="true" />,
  },
  {
    title: "2. Trouvez des projets",
    description:
      "Parcourez les briefs publiés par les clients. Filtrez par catégorie, budget et pays. Débloquez le contact d'un client avec votre quota mensuel.",
    icon: <Search className="size-8" aria-hidden="true" />,
  },
  {
    title: "3. Échangez dans la messagerie",
    description:
      "Discutez directement avec le client dans la messagerie interne. Envoyez votre devis et proposez votre approche. Pas de commission sur les missions.",
    icon: <MessageSquare className="size-8" aria-hidden="true" />,
  },
  {
    title: "4. Abonnement et quota",
    description:
      "Avec un abonnement Pro, vous débloquez jusqu'à 80 contacts/mois. Les contacts bonus du classement s'ajoutent à votre quota. Plan gratuit : 1 contact/mois.",
    icon: <Star className="size-8" aria-hidden="true" />,
  },
  {
    title: "5. Paiement sécurisé (escrow)",
    description:
      "Le client paie la mission. Les fonds sont bloqués sur la plateforme et libérés vers votre wallet après validation du projet par le client.",
    icon: <ShieldCheck className="size-8" aria-hidden="true" />,
  },
  {
    title: "6. Classement et récompenses",
    description:
      "Terminez des projets pour monter dans le classement mensuel. Les 3 premiers reçoivent des contacts bonus (10/7/4) chaque mois. Le classement est mondial.",
    icon: <Trophy className="size-8" aria-hidden="true" />,
  },
  {
    title: "7. Retirez vos gains",
    description:
      "Demandez un retrait depuis votre wallet (minimum 5 000 FCFA) via Wave, Orange Money, Mobicash ou virement bancaire. L'admin traite la demande.",
    icon: <Wallet className="size-8" aria-hidden="true" />,
  },
  {
    title: "8. C'est parti !",
    description:
      "Consultez les projets ouverts et débloquez votre premier contact. Votre abonnement gratuit vous donne 1 contact/mois pour commencer.",
    icon: <Rocket className="size-8" aria-hidden="true" />,
  },
];
