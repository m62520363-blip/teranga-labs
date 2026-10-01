import {
  Boxes,
  Code2,
  Globe,
  Layout,
  RefreshCw,
  Rocket,
  ShoppingCart,
  TrendingUp,
  Wrench,
} from "lucide-react";

/* --------------------------------------------------------------------------- */
/*  Données éditables de la landing page — TERANGA LABS.                        */
/*  Positionnement réel : marketplace inversé du Sénégal.                      */
/*  Clients → briefs (1 Token) → développeurs débloquent le contact (1 Token).  */
/*  Règle : ne jamais inventer de stats/clients/témoignages réels.             */
/* --------------------------------------------------------------------------- */

export const BRAND = "TERANGA LABS";

export const META = {
  title: "Des clients qui veulent des sites. Tous les jours au Sénégal. — TERANGA LABS",
  description:
    "TERANGA LABS, le marketplace inversé du Sénégal. Les clients publient le brief de leur site web pour 1 Token ; les développeurs sérieux débloquent le contact avec 1 Token (2 500 F) et écrivent directement. Sans commission.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://teranga-labs.vercel.app",
  keywords:
    "marketplace Sénégal, développeurs Sénégal, freelance Sénégal, brief web, trouver des clients web, acheter des tokens, site e-commerce Dakar, développeur web Thiès, marketplace inversée",
};

/* ---------------------------------  HERO  ---------------------------------- */

export const HERO = {
  badge: "LE MARKETPLACE INVERSÉ DU SÉNÉGAL",
  titleA: "Des clients qui veulent des sites.",
  titleB: "Tous les jours au Sénégal.",
  subtitle:
    "Une boutique à Thiès, un resto à Dakar, une école à Saint-Louis : ils publient leur brief pour 1 Token. Les développeurs sérieux débloquent leur contact avec 1 Token et écrivent directement.",
  ctaPrimary: { label: "Publier un brief", href: "/poster" },
  ctaSecondary: {
    label: "Je cherche une mission",
    href: "/briefs",
  },
};

export const HERO_DEMO = {
  label: "Comment ça marche",
  request: {
    title: "Je veux un site e-commerce pour ma boutique",
    budget: "Budget : 150 000 FCFA",
    location: "Dakar · Discussion privée",
  },
  flow: [
    { step: "01 · Brief publié", detail: "1 Token — 2 minutes", delay: 0.6 },
    { step: "02 · 1 Token = 2 500 F", detail: "Le dev démarre la discussion", delay: 1.6 },
    { step: "03 · Discussion sécurisée", detail: "Messagerie interne en direct", delay: 2.6 },
  ],
};

/* -------------------------------  PROBLÈME  -------------------------------- */

export const PROBLEM = {
  eyebrow: "LE PROBLÈME",
  title: "Pourquoi chercher pendant des heures ?",
  lead:
    "Le modèle classique (Upwork, ComeUp) marche à l’envers — et ça marche mal. Le client est spammé, les développeurs gaspillent leur temps, et tout le monde perd.",
  points: [
    { stat: "1 besoin", label: "posté, pour des dizaines de contacts" },
    { stat: "50 devs", label: "qui se battent pour un petit budget" },
    { stat: "0 filtre", label: "le client est noyé sous les messages" },
    { stat: "0 %", label: "de temps réellement gagné" },
  ],
  transition: "On a inversé le modèle.",
  transitionSub:
    "Seuls les développeurs sérieux — ceux qui ont investi un Token — contactent un client.",
};

/* --------------------------------  CONCEPT  -------------------------------- */

export const CONCEPT = {
  eyebrow: "LE CONCEPT",
  title: "On ne vend pas des sites. On vend l’accès aux clients qui veulent des sites.",
  lead:
    "1 Token = 2 500 F = 1 contact client. Vous ne payez que pour ce qui vous intéresse. Le client, lui, paie 1 Token pour publier son brief.",
  classic: [
    { label: "Le client poste un besoin" },
    { label: "50 devs se battent" },
    { label: "Le client est spammé" },
    { label: "Les devs perdent leur temps" },
    { label: "Commission de 20 % sur le projet" },
  ],
  inverted: [
    { label: "Le client poste son brief pour 1 Token", highlight: true },
    { label: "Le brief entre dans /briefs" },
    { label: "Le dev paie 1 Token = 2 500 F" },
    { label: "Discussion interne ouverte en direct" },
    { label: "Zéro commission, zéro intermédiaire", highlight: true },
  ],
};

/* -----------------------------  COMMENT ÇA MARCHE  ------------------------- */

export const STEPS = [
  {
    num: "01",
    title: "Décrivez votre besoin",
    text: "Publiez votre brief en 2 minutes : type de site, budget, région et votre WhatsApp restent privés. 1 Token, sans abonnement.",
    icon: "pen",
  },
  {
    num: "02",
    title: "Seuls les devs sérieux vous contactent",
    text: "Le développeur qui voit votre brief paie 1 Token (2 500 F) pour démarrer une discussion privée. Pas de touristes.",
    icon: "inbox",
  },
  {
    num: "03",
    title: "Choisissez votre meilleure offre",
    text: "Vous comparez les développeurs qui vous ont contacté dans votre messagerie interne, et vous choisissez en toute liberté.",
    icon: "check",
  },
] as const;

/* ---------------------------------  BUYER  --------------------------------- */

export const BUYER = {
  eyebrow: "POUR LES CLIENTS",
  title: "Vous cherchez un développeur ?",
  lead:
    "Dites ce dont vous avez besoin : type de site, budget, région. Les développeurs sérieux viennent à vous dans votre messagerie.",
  cta: { label: "Publier mon brief", href: "/poster" },
  caption: "1 brief publié. Plusieurs développeurs sérieux.",
  form: {
    questionLabel: "Quel type de site ?",
    questionValue: "Ex. Site e-commerce",
    budgetLabel: "Votre budget",
    budgetValue: "Ex. 150 000 FCFA",
    cityLabel: "Votre région",
    cityValue: "Ex. Dakar",
contactLabel: "Votre WhatsApp (reste privé)",
    contactValue: "Ex. +221 7X XX XX XX",
  },
};

/* ---------------------------------  SELLERS  ------------------------------- */

export const SELLERS = {
  eyebrow: "POUR LES DÉVELOPPEURS",
  title: "Arrêtez de courir après les clients.",
  lead:
    "Les clients viennent à vous tous les jours. Et vous ne payez que pour les briefs qui vous intéressent.",
  benefits: [
    "Développeur : 1 Token = 1 contact client (2 500 F), sans commission de 20 %",
    "Fini de vendre sur Facebook : les briefs arrivent tout seuls",
    "Vous ne payez que pour ce qui vous intéresse",
    "Contact via la messagerie interne sécurisée",
    "Des clients sérieux, filtrés par le Token",
  ],
  cta: { label: "Découvrir les briefs", href: "/briefs" },
  notification: {
    title: "Brief intéressant",
    text: "Site e-commerce pour boutique — Thiès",
    budget: "Budget : 150 000 FCFA",
    location: "Région : Thiès · Discussion privée",
    reply: "Démarrer la discussion — 1 Token",
  },
};

/* ---------------------------------  DÉMO  ---------------------------------- */

export const DEMO = {
  eyebrow: "LE PRODUIT",
  title: "Voyez TERANGA LABS en action.",
  lead:
    "Un brief publié pour 1 Token, un développeur sérieux qui ouvre la discussion, un échange en direct.",
  request: {
    title: "Brief : site e-commerce pour boutique de vêtements",
    budget: "Budget : 150 000 FCFA",
    location: "Thiès · Discussion privée",
  },
  flow: [
    {
      step: "Brief publié",
      badge: "Étape 1",
      badgeTone: "success",
    },
    {
      step: "1 Token (2 500 F) ouvre la discussion",
      badge: "Étape 2",
      badgeTone: "warning",
    },
    {
      step: "Échange en direct, sans commission",
      badge: "Étape 3",
      badgeTone: "success",
    },
  ],
  cta: { label: "Voir les briefs en direct", href: "/briefs" },
};

/* ------------------------------  CATÉGORIES  ------------------------------- */

export const CATEGORIES = [
  { icon: Layout, title: "Site vitrine", text: "Présenter son activité" },
  { icon: ShoppingCart, title: "E-commerce", text: "Vendre en ligne sur tout le Sénégal" },
  { icon: Rocket, title: "Landing page", text: "Convertir en une seule page" },
  { icon: Code2, title: "Application web", text: "Outils et plateformes sur mesure" },
  { icon: Boxes, title: "Plateforme SaaS", text: "Services en ligne récurrents" },
  { icon: RefreshCw, title: "Refonte de site", text: "Moderniser un site existant" },
  { icon: Globe, title: "Portail web", text: "Etude, média, association" },
  { icon: TrendingUp, title: "SEO & visibilité", text: "Être trouvé sur Google" },
  { icon: Wrench, title: "Maintenance", text: "Mises à jour et support" },
] as const;

/* ---------------------------------  BÉNÉFICES  ----------------------------- */

export const BENEFITS = {
  eyebrow: "POURQUOI TERANGA LABS",
  title: "Pensé pour le marché sénégalais.",
  cards: [
    {
      title: "1 Token par brief",
      text: "L’inscription est gratuite, la publication d’un brief coûte 1 Token (2 500 FCFA). Seuls les développeurs sérieux contactent.",
    },
{
      title: "Développeur : 1 Token = 1 contact",
      text: "Les développeurs paient 2 500 F pour débloquer un contact qui les intéresse.",
    },
    {
      title: "Zéro commission",
      text: "Pas de 20 % prélevés sur votre projet. Vous payez l’accès, pas la vente.",
    },
    {
      title: "Pensé pour le Sénégal",
      text: "Briefs en français, budgets en FCFA, messagerie interne sécurisée, régions partout au pays.",
    },
  ],
};

/* ---------------------------------  CONFIANCE  ----------------------------- */

export const TRUST_FEATURES = [
  {
    title: "Publication simple",
    text: "Le client décrit son besoin et son budget. Son WhatsApp reste privé. 1 Token par brief, aucun abonnement.",
    status: "Disponible" as const,
  },
  {
title: "Développeur : 1 Token = 1 contact",
    text: "Habituellement 2 500 F : vous débloquez le contact client d’un brief qui vous intéresse.",
    status: "Disponible" as const,
  },
  {
    title: "Messagerie interne sécurisée",
    text: "Aucun intermédiaire, aucune commission : la discussion se fait en direct sur la plateforme, le WhatsApp reste privé.",
    status: "Disponible" as const,
  },
  {
    title: "Paiement des Tokens",
    text: "Commandez vos Tokens auprès de l’équipe, réglés sur Wave ou Max It. Le paiement en ligne arrive bientôt.",
    status: "Bientôt disponible" as const,
  },
  {
    title: "Réputation des développeurs",
    text: "Notes et avis vérifiés pour savoir qui est sérieux avant de choisir.",
    status: "Bientôt disponible" as const,
  },
  {
    title: "Signalement et modération",
    text: "Signalez un abus en un clic. Chaque signalement est traité par l’équipe.",
    status: "Bientôt disponible" as const,
  },
];

/* --------------------------------  STATISTIQUES  --------------------------- */

export const STATS_PLACEHOLDER_LEGEND =
  "Les chiffres ci-dessous s’affichent en direct dès la connexion de la base de données.";

/* -------------------------------  TÉMOIGNAGES  ----------------------------- */
/* La section témoignages a été retirée tant qu'aucun avis réel n'existe.      */
/* Les trois profils d'exemple (Aïssatou D., Malick W., Fatou D.) ont été    */
/* supprimés : de faux témoignages décrédibilisent plus qu'ils ne convainquent.*/
/* Les réintroduire uniquement avec de vrais avis vérifiés.                    */

/* -----------------------------------  FAQ  --------------------------------- */

export const FAQS = [
  {
    q: "Qu’est-ce que TERANGA LABS ?",
    a: "TERANGA LABS est le marketplace inversé du Sénégal : les clients publient le brief de leur site web pour 1 Token, et les développeurs sérieux viennent vers eux.",
  },
  {
    q: "Comment fonctionne le modèle ?",
    a: "Le client poste son brief en 2 minutes : type de site, budget et région. Le brief apparaît dans /briefs. Le développeur qui s’intéresse paie 1 Token pour ouvrir une discussion privée avec le client, puis l’échange se fait en direct sur la plateforme.",
  },
  {
    q: "Combien coûte la publication d’un brief ?",
    a: "1 Token (2 500 FCFA). La création du compte est gratuite. Vous commandez vos Tokens auprès de l’équipe, puis vous publiez votre brief en 2 minutes. Le développeur, lui, paie 1 Token de plus pour démarrer la discussion avec vous.",
  },
  {
    q: "Comment acheter des Tokens ?",
    a: "Les Tokens se commandent auprès de l’équipe : vous nous écrivez, vous réglez par Wave ou Max It, et nous créditons vos Tokens une fois le paiement confirmé. Le paiement en ligne directement sur le site arrive bientôt.",
  },
  {
    q: "Combien coûte un Token ?",
    a: "1 Token = 2 500 F, et il débloque le contact d’un brief. Vous ne payez donc que pour les contacts qui vous intéressent vraiment.",
  },
  {
    q: "Y a-t-il une commission sur les projets ?",
    a: "Non. TERANGA LABS ne prélève aucune commission sur les projets. Le modèle repose uniquement sur la vente de Tokens : vous vendez l’accès, pas la vente.",
  },
  {
    q: "TERANGA LABS est-il disponible au Sénégal ?",
    a: "Oui. Tout est pensé pour le marché local : briefs en français, budgets en FCFA, régions partout au pays, et messagerie interne en temps réel.",
  },
];

/* ---------------------------------  CTA FINAL  ------------------------------ */

export const CTA = {
  titleA: "Quelqu’un cherche votre prochain projet",
  titleB: "en ce moment même.",
  text: "Publiez le brief de votre site pour 1 Token. Ou découvrez les briefs qui recherchent déjà un développeur.",
  ctaPrimary: { label: "Publier mon brief", href: "/poster" },
  ctaSecondary: { label: "Je suis développeur", href: "/briefs" },
};
