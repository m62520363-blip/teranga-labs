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
  badge: "LE MARKETPLACE DES PROJETS WEB DE L'AFRIQUE DE L'OUEST FRANCOPHONE",
  titleA: "Des entreprises qui cherchent",
  titleB: "un développeur web.",
  subtitle:
    "Publiez votre besoin en 2 minutes. Les développeurs sérieux viennent à vous, sans commission et sans intermédiaire.",
  ctaPrimary: { label: "Je cherche un développeur", href: "/poster" },
  ctaSecondary: { label: "Je cherche des missions", href: "/briefs" },
  chips: [
    "Paiement en ligne : Wave, Max It, carte",
    "Aucune commission sur les projets",
    "9 pays d'Afrique de l'Ouest francophone",
  ],
};

export const HERO_DEMO = {
  label: "Comment ça marche",
  request: { title: "Je veux un site e-commerce pour ma boutique", budget: "Budget : 150 000 FCFA", location: "Afrique de l'Ouest francophone - Discussion privée" },
  flow: [
    { step: "01 - Brief publié", detail: "1 Token - 2 minutes", delay: 0.6 },
    { step: "02 - Le dev paie 1 Token", detail: "Il démarre la discussion", delay: 1.6 },
    { step: "03 - Discussion sécurisée", detail: "Messagerie interne en direct", delay: 2.6 },
  ],
};

export const CONCEPT = {
  eyebrow: "LE CONCEPT",
  title: "On ne vend pas des sites. On vend l'accès aux clients qui veulent des sites.",
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
  title: "Vous cherchez un développeur de confiance ?",
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
    contactValue: "Ex. +225 07 07 07 07 07",
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
    "Paiement en ligne : Wave, Max It ou carte bancaire",
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
  { title: "Développeur : 1 Token = 1 contact", text: "Vous débloquez le contact client d'un brief qui vous intéresse, puis la discussion démarre en direct.", status: "Disponible" as const },
  { title: "Messagerie interne sécurisée", text: "Aucun intermédiaire, aucune commission : la discussion se fait en direct sur la plateforme, le WhatsApp reste privé.", status: "Disponible" as const },
  { title: "Paiement en ligne des Tokens", text: "Réglez vos Tokens par Wave, Max It ou carte bancaire. Confirmation immédiate, Tokens crédités automatiquement.", status: "Disponible" as const },
  { title: "Avis et réputation", text: "Notes et avis vérifiés après mission, pour savoir qui est sérieux avant de choisir.", status: "Disponible" as const },
  { title: "Signalement et modération", text: "Signalez un abus en un clic. Chaque signalement est lu et traité par l'équipe.", status: "Disponible" as const },
];

export const STATS_PLACEHOLDER_LEGEND = "Les chiffres ci-dessous s'affichent en direct dès la connexion de la base de données.";

export const FAQS = [
  { q: "Qu'est-ce que TERANGA LABS ?", a: "TERANGA LABS est le marketplace des projets web de l'Afrique de l'Ouest francophone : les clients publient le brief de leur site web pour 1 Token, et les développeurs sérieux viennent vers eux." },
  { q: "Comment fonctionne le modèle ?", a: "Le client poste son brief en 2 minutes : type de site, budget et région. Le brief apparaît dans /briefs. Le développeur qui s'intéresse paie 1 Token pour ouvrir une discussion privée avec le client, puis l'échange se fait en direct sur la plateforme." },
  { q: "Combien coûte un Token ?", a: `${TOKEN_LABEL_PRICED}. L'inscription est gratuite : vous commandez vos Tokens, puis vous publiez votre brief ou débloquez un contact.` },
  { q: "Comment je paie mes Tokens ?", a: "Le paiement se fait en ligne depuis la page Tokens : Wave, Max It ou carte bancaire. Dès la confirmation du paiement, vos Tokens sont crédités automatiquement sur votre compte." },
  { q: "Mon numéro WhatsApp reste-t-il privé ?", a: "Oui. Votre numéro n'apparaît jamais sur les briefs ni dans les résultats de recherche : les échanges passent par la messagerie interne, et vous décidez seul de quand donner votre contact." },
  { q: "Dans quels pays le service est-il disponible ?", a: "Dans les 9 pays d'Afrique de l'Ouest francophone : Sénégal, Côte d'Ivoire, Mali, Burkina Faso, Niger, Guinée, Guinée-Bissau, Bénin et Togo. Les prix sont affichés en FCFA (en GNF pour la Guinée)." },
  { q: "Existe-t-il un classement des développeurs ?", a: "Oui : un classement mensuel, régional et par pays. Seuls les 2 premiers sont récompensés en Tokens, et il faut au moins 2 projets terminés et confirmés dans le mois pour y figurer." },
  { q: "Y a-t-il une commission sur les projets ?", a: "Non. TERANGA LABS ne prélève aucune commission sur les projets : le développeur et le client traitent ensemble, sans intermédiaire." },
];

export const CTA = {
  titleA: "Un projet vous attend peut-être",
  titleB: "sur TERANGA LABS.",
  text: "Publiez le brief de votre site pour 1 Token. Ou découvrez les briefs qui recherchent déjà un développeur, partout en Afrique de l'Ouest francophone.",
  ctaPrimary: { label: "Publier mon brief", href: "/poster" },
  ctaSecondary: { label: "Je suis développeur", href: "/briefs" },
};
