import { TOKEN_LABEL_PRICED, TOKEN_RULE } from "@/lib/formatting";

/* --------------------------------------------------------------------------- */
/*  Données éditables de la landing page à TERANGA LABS.                        */
/*  Positionnement : marketplace des projets web de l'Afrique de l'Ouest francophone. */
/* --------------------------------------------------------------------------- */

export const BRAND = "TERANGA LABS";
export const LEGAL_PUBLISHER = "Walty Group-SUARL";

export const META = {
  title: "Le marketplace des projets web de l'Afrique de l'Ouest francophone | TERANGA LABS",
  description:
    "TERANGA LABS, le marketplace des projets web de l'Afrique de l'Ouest francophone. Le client publie son brief pour 1 Token, le développeur débloque le contact avec 1 Token et tout se règle en direct. Aucune commission.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://teranga-labs.vercel.app",
  keywords:
    "marketplace Afrique de l'Ouest francophone, développeurs Sénégal, développeurs Côte d'Ivoire, freelance Dakar, Abidjan, Bamako, brief web, trouver des clients web, acheter des tokens, classement développeurs, site e-commerce Dakar, TERANGA LABS",
};

export const HERO = {
  badge: "Aucune commission, jamais",
  title: "Trouve ton développeur web, paie",
  /** Mots en rotation (sérif italique, primaire) après « paie ». */
  rotating: ["sans commission.", "avec 1 Token.", "sans intermédiaire."],
  subtitle:
    "Publie ton brief en 2 minutes. Les développeurs sérieux viennent à toi — ton WhatsApp reste privé.",
  ctaPrimary: { label: "Trouver un développeur", href: "/dev" },
  ctaSecondary: { label: "Publier un brief", href: "/poster" },
};

export const HOW_IT_WORKS = {
  badge: "Aucune commission, jamais",
  titleA: "Comment ça marche",
  titleB: "vraiment.",
  lead: "Ni les groupes WhatsApp ni les plateformes étrangères ne garantissent le bon match au bon prix — TERANGA le fait au même endroit.",
  steps: [
    {
      num: "01",
      title: "Trouve le bon développeur",
      text: "Filtre par pays, compétence et note. Chaque profil affiche un portfolio de projets réels livrés en Afrique de l'Ouest.",
      icon: "search",
    },
    {
      num: "02",
      title: "Publie ton brief",
      text: "Brief structuré : type de site, budget en FCFA, délai de livraison. 1 Token, sans abonnement.",
      icon: "file-text",
    },
    {
      num: "03",
      title: "Le contact se débloque en 1 Token",
      text: "Le développeur intéressé paie 1 Token pour t'écrire. Ta discussion privée s'ouvre — plus de candidatures sauvages.",
      icon: "shield-check",
    },
    {
      num: "04",
      title: "Discutez en direct",
      text: "Devis, détails, calendrier : tout passe par la messagerie interne. Ton WhatsApp reste privé jusqu'à ton accord.",
      icon: "message-circle",
    },
    {
      num: "05",
      title: "Choisis et paie sans commission",
      text: "Vous réglez ensemble, directement. TERANGA ne prélève rien sur ton projet.",
      icon: "circle-check",
    },
  ],
} as const;

export const PRICING = {
  titleA: "Des tarifs",
  titleB: "sans surprise.",
  lead: "Pas d'abonnement, pas de frais cachés. TERANGA ne gagne de l'argent que quand tu utilises un Token.",
  cards: [
    {
      eyebrow: "Client",
      price: "1 Token",
      text: "Tu paies 1 Token pour publier ton brief. Rien de plus — ton budget part entièrement au développeur.",
      highlighted: false,
    },
    {
      eyebrow: "Développeur",
      price: "0 %",
      text: "Aucune commission sur les projets. 1 Token débloque un contact client — bien moins que les 20 % de Fiverr, et rien tant que tu ne gagnes pas.",
      highlighted: true,
    },
  ],
} as const;

export const FAQS_LANDING = [
  {
    q: "Qu'est-ce que TERANGA LABS ?",
    a: "TERANGA LABS est le marketplace des projets web de l'Afrique de l'Ouest francophone : tu publies le brief de ton site pour 1 Token, et le développeur intéressé débloque ton contact avec 1 Token. Ensuite, vous traitez directement — aucune commission.",
  },
  {
    q: "Combien coûte un Token ?",
    a: `${TOKEN_LABEL_PRICED}. L'inscription est gratuite : tu commandes tes Tokens en ligne depuis ton wallet, puis tu publies ton brief ou tu débloques un contact.`,
  },
  {
    q: "Y a-t-il une commission sur les projets ?",
    a: "Non. TERANGA LABS ne prélève aucune commission sur les projets : le développeur et le client traitent ensemble, sans intermédiaire. Contre 15 à 20 % prélevés ailleurs, ici tu gardes 100 % de ton budget.",
  },
  {
    q: "Mon WhatsApp reste-t-il privé ?",
    a: "Oui. Ton numéro n'apparaît jamais sur les briefs ni dans les résultats de recherche : les échanges passent par la messagerie interne, et tu décides seul de quand donner ton contact.",
  },
  {
    q: "Dans quels pays le service est-il disponible ?",
    a: "Partout dans le monde : chaque pays et chaque région sont disponibles à l'inscription, et les prix s'affichent dans la devise locale (FCFA, USD, EUR, …).",
  },
];

export const ROLE_CARDS = {
  client: {
    eyebrow: "Client",
    title: "Arrête de chercher sur WhatsApp.",
    text: "En 5 minutes, décris ton projet, mets ton budget et rejoins les développeurs sérieux de toute la région. Ton argent reste le tien jusqu'à ce que tu choisisses.",
    bullets: [
      "Brief publié pour 1 Token, sans abonnement",
      "Dev sérieux : ils paient 1 Token pour t'écrire",
      "Aucune commission sur ton projet",
      "Paiement 100 % depuis ton wallet",
    ],
    cta: { label: "Publier mon brief", href: "/poster" },
  },
  developer: {
    eyebrow: "Développeur",
    title: "Sois trouvé sur ta compétence réelle.",
    text: "Crée ton profil avec ton portfolio. Les clients te trouvent selon ta spécialité et ton pays. Tu es payé directement, sans friction.",
    bullets: [
      "Profil public avec portfolio de projets",
      "Reçois des briefs par pays et par niche",
      "1 Token = 1 contact client, 0 commission",
      "Paiement direct, sans commission",
    ],
    cta: { label: "Voir les briefs", href: "/briefs" },
  },
};

export const FAQS = [
  { q: "Qu'est-ce que TERANGA LABS ?", a: "TERANGA LABS est le marketplace des projets web de l'Afrique de l'Ouest francophone : les clients publient le brief de leur site web pour 1 Token, et les développeurs sérieux viennent vers eux." },
  { q: "Comment fonctionne le modèle ?", a: "Le client poste son brief en 2 minutes : type de site, budget et région. Le brief apparaît dans /briefs. Le développeur qui s'intéresse paie 1 Token pour ouvrir une discussion privée avec le client, puis l'échange se fait en direct sur la plateforme." },
  { q: "Combien coûte un Token ?", a: `${TOKEN_LABEL_PRICED}. L'inscription est gratuite : vous commandez vos Tokens, puis vous publiez votre brief ou débloquez un contact.` },
  { q: "Comment je paie mes Tokens ?", a: "Le paiement se fait en ligne depuis votre wallet : rechargez-le, puis dépensez vos Tokens partout sur le site. Dès la confirmation du paiement, vos Tokens sont crédités automatiquement sur votre compte." },
  { q: "Mon numéro WhatsApp reste-t-il privé ?", a: "Oui. Votre numéro n'apparaît jamais sur les briefs ni dans les résultats de recherche : les échanges passent par la messagerie interne, et vous décidez seul de quand donner votre contact." },
      { q: "Dans quels pays le service est-il disponible ?", a: "Partout dans le monde : chaque pays et chaque région sont disponibles à l'inscription, et les prix s'affichent dans la devise locale (FCFA, USD, EUR, …)." },
  { q: "Existe-t-il un classement des développeurs ?", a: "Oui : un classement mondial, récompensé chaque mois. Les 3 premiers reçoivent 10, 7 et 4 Tokens, il faut au moins 2 projets terminés et confirmés dans le mois pour y figurer, et chaque projet terminé vaut 50 points." },
  { q: "Y a-t-il une commission sur les projets ?", a: "Non. TERANGA LABS ne prélève aucune commission sur les projets : le développeur et le client traitent ensemble, sans intermédiaire." },
];

export { TOKEN_RULE };
