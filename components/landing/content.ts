import { TOKEN_LABEL_PRICED, TOKEN_RULE } from "@/lib/formatting";


/* --------------------------------------------------------------------------- */
/*  Donn�es �ditables de la landing page � TERANGA LABS.                        */
/*  Positionnement r�el : marketplace invers� de l'Afrique de l'Ouest francophone.                      */
/*  Clients é briefs (1 Token) é d�veloppeurs d�bloquent le contact (1 Token).  */
/*  R�gle : ne jamais inventer de stats/clients/t�moignages r�els.             */
/* --------------------------------------------------------------------------- */

export const BRAND = "TERANGA LABS";

/** Structure juridique qui �dite la marque, affich�e dans le footer et les pages l�gales. */
export const LEGAL_PUBLISHER = "Walty Group-SUARL";

export const META = {
  title: "Le marketplace invers� de l'Afrique de l'Ouest francophone � briefs web et d�veloppeurs � TERANGA LABS",
  description:
    "TERANGA LABS, le marketplace invers� de l'Afrique de l'Ouest francophone. Les clients publient le brief de leur site web pour 1 Token ; les d�veloppeurs d�bloquent le contact avec 1 Token et �crivent directement. Aucune commission.",
  url: process.env.NEXT_PUBLIC_SITE_URL éé "https://teranga-labs.vercel.app",
  keywords:
    "marketplace Afrique de l'Ouest francophone, d�veloppeurs Afrique de l'Ouest francophone, freelance Afrique de l'Ouest francophone, brief web, trouver des clients web, acheter des tokens, site e-commerce Dakar, d�veloppeur web Thi�s, marketplace invers�e",
};

/* ---------------------------------  HERO  ---------------------------------- */

export const HERO = {
  badge: "LE MARKETPLACE INVERS� de l'Afrique de l'Ouest francophone",
  titleA: "Des clients qui cherchent",
  titleB: "un d�veloppeur web.",
  subtitle:
    "Une boutique � Thi�s, un resto � Dakar, une �cole � Saint-Louis : ils publient leur brief pour 1 Token. Les d�veloppeurs s�rieux d�bloquent leur contact avec 1 Token et �crivent directement.",
  ctaPrimary: { label: "Je cherche un d�veloppeur", href: "/poster" },
  ctaSecondary: {
    label: "Je cherche des missions",
    href: "/briefs",
  },
};

export const HERO_DEMO = {
  label: "Comment �a marche",
  request: {
    title: "Je veux un site e-commerce pour ma boutique",
    budget: "Budget : 150 000 FCFA",
    location: "Dakar � Discussion priv�e",
  },
  flow: [
    { step: "01 � Brief publi�", detail: "1 Token � 2 minutes", delay: 0.6 },
    { step: "02 � Le dev paie 1 Token", detail: "Il d�marre la discussion", delay: 1.6 },
    { step: "03 � Discussion s�curis�e", detail: "Messagerie interne en direct", delay: 2.6 },
  ],
};

/* --------------------------------  CONCEPT  -------------------------------- */

export const CONCEPT = {
  eyebrow: "LE CONCEPT",
  title: "On ne vend pas des sites. On vend l�acc�s aux clients qui veulent des sites.",
  lead: `${TOKEN_RULE} = 1 contact client. Vous ne payez que pour ce qui vous int�resse. Le client, lui, paie 1 Token pour publier son brief.`,
  classic: [
    { label: "Le client poste un besoin" },
    { label: "Des dizaines de devs se battent" },
    { label: "Le client est spamm�" },
    { label: "Les devs perdent leur temps" },
    { label: "Commission pr�lev�e sur le projet" },
  ],
  inverted: [
    { label: "Le client poste son brief pour 1 Token", highlight: true },
    { label: "Le brief entre dans /briefs" },
    { label: "Le dev paie 1 Token" },
    { label: "Discussion interne ouverte en direct" },
    { label: "Z�ro commission, z�ro interm�diaire", highlight: true },
  ],
};

/* -----------------------------  COMMENT �A MARCHE  ------------------------- */

export const STEPS = [
  {
    num: "01",
    title: "D�crivez votre besoin",
    text: "Publiez votre brief en 2 minutes : type de site, budget, r�gion et votre WhatsApp restent priv�s. 1 Token, sans abonnement.",
    icon: "pen",
  },
  {
    num: "02",
    title: "Seuls les devs s�rieux vous contactent",
    text: "Le d�veloppeur qui voit votre brief paie 1 Token pour d�marrer une discussion priv�e. Pas de touristes.",
    icon: "inbox",
  },
  {
    num: "03",
    title: "Choisissez votre meilleure offre",
    text: "Vous comparez les d�veloppeurs qui vous ont contact� dans votre messagerie interne, et vous choisissez en toute libert�.",
    icon: "check",
  },
] as const;

/* ---------------------------------  BUYER  --------------------------------- */

export const BUYER = {
  eyebrow: "POUR LES CLIENTS",
  title: "Vous cherchez un d�veloppeur é",
  lead:
    "Dites ce dont vous avez besoin : type de site, budget, r�gion. Les d�veloppeurs s�rieux viennent � vous dans votre messagerie.",
  cta: { label: "Publier mon brief", href: "/poster" },
  caption: "1 brief publi�. Plusieurs d�veloppeurs s�rieux.",
  form: {
    questionLabel: "Quel type de site é",
    questionValue: "Ex. Site e-commerce",
    budgetLabel: "Votre budget",
    budgetValue: "Ex. 150 000 FCFA",
    cityLabel: "Votre r�gion",
    cityValue: "Ex. Dakar",
contactLabel: "Votre WhatsApp (reste priv�)",
    contactValue: "Ex. +221 7X XX XX XX",
  },
};

/* ---------------------------------  SELLERS  ------------------------------- */

export const SELLERS = {
  eyebrow: "POUR LES D�VELOPPEURS",
  title: "Arr�tez de courir apr�s les clients.",
  lead:
    "Les briefs publi�s vous attendent, avec leur budget et leur r�gion. Et vous ne payez que pour ceux qui vous int�ressent.",
  benefits: [
    "D�veloppeur : 1 Token = 1 contact client, sans commission sur le projet",
    "Fini de vendre sur Facebook : les briefs arrivent tout seuls",
    "Vous ne payez que pour ce qui vous int�resse",
    "Contact via la messagerie interne s�curis�e",
    "Des clients s�rieux, filtr�s par le Token",
  ],
  cta: { label: "D�couvrir les briefs", href: "/briefs" },
  notification: {
    title: "Brief int�ressant",
    text: "Site e-commerce pour boutique � Thi�s",
    budget: "Budget : 150 000 FCFA",
    location: "R�gion : Thi�s � Discussion priv�e",
    reply: "D�marrer la discussion � 1 Token",
  },
};

/* ---------------------------------  CONFIANCE  ----------------------------- */

export const TRUST_FEATURES = [
  {
    title: "Publication simple",
    text: "Le client d�crit son besoin et son budget. Son WhatsApp reste priv�. 1 Token par brief, aucun abonnement.",
    status: "Disponible" as const,
  },
  {
title: "D�veloppeur : 1 Token = 1 contact",
    text: "Vous d�bloquez le contact client d�un brief qui vous int�resse.",
    status: "Disponible" as const,
  },
  {
    title: "Messagerie interne s�curis�e",
    text: "Aucun interm�diaire, aucune commission : la discussion se fait en direct sur la plateforme, le WhatsApp reste priv�.",
    status: "Disponible" as const,
  },
  {
    title: "Paiement des Tokens",
    text: "Commandez vos Tokens aupr�s de l��quipe, r�gl�s sur Wave ou Max It. Le paiement en ligne arrive bient�t.",
    status: "Bient�t disponible" as const,
  },
  {
    title: "R�putation des d�veloppeurs",
    text: "Notes et avis v�rifi�s pour savoir qui est s�rieux avant de choisir.",
    status: "Bient�t disponible" as const,
  },
  {
    title: "Signalement et mod�ration",
    text: "Signalez un abus en un clic. Chaque signalement est trait� par l��quipe.",
    status: "Bient�t disponible" as const,
  },
];

/* --------------------------------  STATISTIQUES  --------------------------- */

export const STATS_PLACEHOLDER_LEGEND =
  "Les chiffres ci-dessous s�affichent en direct d�s la connexion de la base de donn�es.";

/* -------------------------------  T�MOIGNAGES  ----------------------------- */
/* La section t�moignages a �t� retir�e tant qu'aucun avis r�el n'existe.      */
/* Les trois profils d'exemple (A�ssatou D., Malick W., Fatou D.) ont �t�    */
/* supprim�s : de faux t�moignages d�cr�dibilisent plus qu'ils ne convainquent.*/
/* Les r�introduire uniquement avec de vrais avis v�rifi�s.                    */

/* -----------------------------------  FAQ  --------------------------------- */

export const FAQS = [
  {
    q: "Qu�est-ce que TERANGA LABS é",
    a: "TERANGA LABS est le marketplace invers� de l'Afrique de l'Ouest francophone : les clients publient le brief de leur site web pour 1 Token, et les d�veloppeurs s�rieux viennent vers eux.",
  },
  {
    q: "Comment fonctionne le mod�le é",
    a: "Le client poste son brief en 2 minutes : type de site, budget et r�gion. Le brief appara�t dans /briefs. Le d�veloppeur qui s�int�resse paie 1 Token pour ouvrir une discussion priv�e avec le client, puis l��change se fait en direct sur la plateforme.",
  },
  {
    q: "Combien co�te un Token é",
    a: `${TOKEN_LABEL_PRICED}. L�inscription est gratuite : vous commandez vos Tokens, puis vous publiez votre brief ou d�bloquez un contact. Le d�veloppeur paie son propre Token pour d�marrer la discussion.`,
  },
  {
    q: "Comment acheter des Tokens é",
    a: "Les Tokens se commandent aupr�s de l��quipe : vous nous �crivez, vous r�glez par Wave ou Max It, et nous cr�ditons vos Tokens une fois le paiement confirm�. Le paiement en ligne directement sur le site arrive bient�t.",
  },
  {
    q: "Y a-t-il une commission sur les projets é",
    a: "Non. TERANGA LABS ne pr�l�ve aucune commission sur les projets. Le mod�le repose uniquement sur la vente de Tokens : vous vendez l�acc�s, pas la vente.",
  },
  {
    q: "Un Token est-il remboursable é",
    a: "Un Token consomm� sur un contact n�est pas remboursable. En cas de contact frauduleux ou de brief fictif, signalez-le dans les 48 heures suivant le d�blocage : apr�s v�rification de la messagerie, l��quipe rembourse en Tokens.",
  },
  {
    q: "TERANGA LABS est-il disponible au Afrique de l'Ouest francophone é",
    a: "Oui. Tout est pens� pour le march� local : briefs en fran�ais, budgets en FCFA, r�gions partout au pays, et messagerie interne en temps r�el.",
  },
];

/* ---------------------------------  CTA FINAL  ------------------------------ */

export const CTA = {
  titleA: "Un projet vous attend peut-�tre",
  titleB: "sur TERANGA LABS.",
  text: "Publiez le brief de votre site pour 1 Token. Ou d�couvrez les briefs qui recherchent d�j� un d�veloppeur.",
  ctaPrimary: { label: "Publier mon brief", href: "/poster" },
  ctaSecondary: { label: "Je suis d�veloppeur", href: "/briefs" },
};
