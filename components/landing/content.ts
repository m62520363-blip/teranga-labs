import { TOKEN_LABEL_PRICED, TOKEN_RULE } from "@/lib/formatting";

/* --------------------------------------------------------------------------- */
/*  Données éditables de la landing page à TERANGA LABS.                        */
/*  Positionnement : marketplace des projets web de l'Afrique de l'Ouest francophone. */
/* --------------------------------------------------------------------------- */

export const BRAND = "TERANGA LABS";
export const LEGAL_PUBLISHER = "Walty Group-SUARL";

export const META = {
  title: "Le marketplace des projets web de l’Afrique de l’Ouest francophone | TERANGA LABS",
  description:
    "TERANGA LABS, le marketplace des projets web de l'Afrique de l'Ouest francophone. Les clients publient leur besoin pour 1 Token ; les développeurs sérieux débloquent le contact avec 1 Token et échangent directement. Aucune commission.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://teranga-labs.vercel.app",
  keywords:
    "marketplace Afrique de l’Ouest francophone, développeurs Afrique de l’Ouest francophone, freelance Afrique de l’Ouest francophone, brief web, trouver des clients web, acheter des tokens, site e-commerce Dakar, développeur web, TERANGA LABS",
};

export const HERO = {
  badge: "LE MARKETPLACE DES PROJETS WEB DE L’AFRIQUE DE L’OUEST FRANCOPHONE",
  titleA: "Des entreprises qui cherchent",
  titleB: "un développeur web.",
  subtitle:
    "Des entreprises qui ont besoin d’un site. Des développeurs qui cherchent des missions. Une plateforme qui les connecte directement.",
  ctaPrimary: { label: "Je cherche un développeur", href: "/poster" },
  ctaSecondary: { label: "Je cherche des missions", href: "/briefs" },
};

export const HERO_DEMO = {
  label: "Comment ça marche",
  request: { title: "Je veux un site e-commerce pour ma boutique", budget: "Budget : 150 000 FCFA", location: "Dakar - Discussion privée" },
  flow: [
    { step: "01 - Brief publié", detail: "1 Token - 2 minutes", delay: 0.6 },
    { step: "02 - Le dev paie 1 Token", detail: "Il démarre la discussion", delay: 1.6 },
    { step: "03 - Discussion sécurisée", detail: "Messagerie interne en direct", delay: 2.6 },
  ],
};

export const CONCEPT = {
  eyebrow: "LE CONCEPT",
  title: "On ne vend pas des sites. On vend l’accès aux clients qui veulent des sites.",
  lead: `${TOKEN_RULE} = 1 contact client. Vous ne payez que pour ce qui vous intéresse. Le client paie 1 Token pour publier son brief.`,
  classic: [
    { label: "Le client poste un besoin" },
    { label: "Des dizaines de devs se battent" },
    { label: "Le client est spammé" },
    { label: "Les devs perdent leur temps" },
    { label: "Commission prélevée sur le projet" },
  ],
  inverted: [
    { label: "Le client poste son brief pour 1 Token", highlight: true },
    { label: "Le brief entre dans /briefs" },
    { label: "Le dev paie 1 Token" },
    { label: "Discussion interne ouverte en direct" },
    { label: "Zéro commission, zéro intermédiaire", highlight: true },
  ],
};

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
    text: "Le développeur qui voit votre brief paie 1 Token pour démarrer une discussion privée. Pas de touristes.",
    icon: "inbox",
  },
  {
    num: "03",
    title: "Choisissez votre meilleure offre",
    text: "Vous comparez les développeurs qui vous ont contacté dans votre messagerie interne, et vous choisissez en toute liberté.",
    icon: "check",
  },
] as const;

export const BUYER = {
  eyebrow: "POUR LES CLIENTS",
  title: "Vous cherchez un développeur à",
  lead: "Dites ce dont vous avez besoin : type de site, budget, région. Les développeurs sérieux viennent à vous dans votre messagerie.",
  cta: { label: "Publier mon brief", href: "/poster" },
  caption: "1 brief publié. Plusieurs développeurs sérieux.",
  form: {
    questionLabel: "Quel type de site à",
    questionValue: "Ex. Site e-commerce",
    budgetLabel: "Votre budget",
    budgetValue: "Ex. 150 000 FCFA",
    cityLabel: "Votre région",
    cityValue: "Ex. Dakar",
    contactLabel: "Votre WhatsApp (reste privé)",
    contactValue: "Ex. +221 7X XX XX XX",
  },
};

export const SELLERS = {
  eyebrow: "POUR LES DÉVELOPPEURS",
  title: "Arrêtez de courir après les clients.",
  lead: "Les briefs publiés vous attendent, avec leur budget et leur région. Et vous ne payez que pour ceux qui vous intéressent.",
  benefits: [
    "Développeur : 1 Token = 1 contact client, sans commission sur le projet",
    "Fini de vendre sur Facebook : les briefs arrivent tout seuls",
    "Vous ne payez que pour ce qui vous intéresse",
    "Contact via la messagerie interne sécurisée",
    "Des clients sérieux, filtrés par le Token",
  ],
  cta: { label: "Découvrir les briefs", href: "/briefs" },
  notification: {
    title: "Brief intéressant",
    text: "Site e-commerce pour boutique à Thiès",
    budget: "Budget : 150 000 FCFA",
    location: "Région : Thiès - Discussion privée",
    reply: "Démarrer la discussion à 1 Token",
  },
};

export const TRUST_FEATURES = [
  { title: "Publication simple", text: "Le client décrit son besoin et son budget. Son WhatsApp reste privé. 1 Token par brief, aucun abonnement.", status: "Disponible" as const },
  { title: "Développeur : 1 Token = 1 contact", text: "Vous débloquez le contact client d’un brief qui vous intéresse.", status: "Disponible" as const },
  { title: "Messagerie interne sécurisée", text: "Aucun intermédiaire, aucune commission : la discussion se fait en direct sur la plateforme, le WhatsApp reste privé.", status: "Disponible" as const },
  { title: "Paiement des Tokens", text: "Commandez vos Tokens auprès de l’équipe, réglés sur Wave ou Max It. Le paiement en ligne arrive bientôt.", status: "Bientôt disponible" as const },
  { title: "Réputation des développeurs", text: "Notes et avis vérifiés pour savoir qui est sérieux avant de choisir.", status: "Bientôt disponible" as const },
  { title: "Signalement et modération", text: "Signalez un abus en un clic. Chaque signalement est traité par l’équipe.", status: "Bientôt disponible" as const },
];

export const STATS_PLACEHOLDER_LEGEND = "Les chiffres ci-dessous s’affichent en direct dès la connexion de la base de données.";

export const FAQS = [
  { q: "Qu’est-ce que TERANGA LABS ?", a: "TERANGA LABS est le marketplace des projets web de l’Afrique de l’Ouest francophone : les clients publient le brief de leur site web pour 1 Token, et les développeurs sérieux viennent vers eux." },
  { q: "Comment fonctionne le modèle ?", a: "Le client poste son brief en 2 minutes : type de site, budget et région. Le brief apparaît dans /briefs. Le développeur qui s’intéresse paie 1 Token pour ouvrir une discussion privée avec le client, puis l’échange se fait en direct sur la plateforme." },
  { q: "Combien coûte un Token ?", a: `${TOKEN_LABEL_PRICED}. L'inscription est gratuite : vous commandez vos Tokens, puis vous publiez votre brief ou débloquez un contact.` },
  { q: "Y a-t-il une commission sur les projets ?", a: "Non. TERANGA LABS ne prélève aucune commission sur les projets." },
];

export const CTA = {
  titleA: "Un projet vous attend peut-être",
  titleB: "sur TERANGA LABS.",
  text: "Publiez le brief de votre site pour 1 Token. Ou découvrez les briefs qui recherchent déjà un développeur.",
  ctaPrimary: { label: "Publier mon brief", href: "/poster" },
  ctaSecondary: { label: "Je suis développeur", href: "/briefs" },
};





