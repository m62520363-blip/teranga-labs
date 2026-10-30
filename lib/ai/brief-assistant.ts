/**
 * Assistant IA complet pour la rédaction d'un brief client (Section E).
 *
 * Couvre les 10 capacités :
 *   1. Comprendre la demande (`understanding`)
 *   2. Identifier les informations manquantes (`missingInfo`)
 *   3. Poser des questions intelligentes (`questions`)
 *   4. Générer un titre professionnel (`title`)
 *   5. Rédiger une description complète (`description`)
 *   6. Identifier les fonctionnalités (`features`)
 *   7. Définir les compétences nécessaires (`skills`)
 *   8. Proposer un budget indicatif (`indicativeBudget`)
 *   9. Proposer un délai indicatif (`indicativeDeadline`)
 *  10. Générer les livrables attendus (`deliverables`)
 *
 * Modes supportés (`AssistMode`) :
 *   - "generate" : Génération structurée complète du brief
 *   - "rewrite"  : Réécriture professionnelle
 *   - "correct"  : Correction orthographique et grammaticale
 *   - "improve"  : Amélioration et enrichissement
 *   - "simplify" : Simplification claire et directe
 *
 * Connecté aux fournisseurs IA compatibles OpenAI / Gemini / Groq configurés
 * via AI_API_KEY / OPENAI_API_KEY / GROQ_API_KEY, avec moteur analytique
 * déterministe de secours garantissant 100 % de disponibilité sans jamais
 * inventer de fausses exigences confirmées.
 */

export type AssistMode =
  | "generate"
  | "rewrite"
  | "correct"
  | "improve"
  | "simplify";

export interface BriefAssistResult {
  description: string;
  suggestions: string[];
  source: "llm" | "rules";
  mode?: AssistMode;
  understanding?: string;
  missingInfo?: string[];
  questions?: string[];
  title?: string;
  projectType?: "vitrine" | "e-commerce" | "landing page" | "app web" | "refonte";
  features?: string[];
  skills?: string[];
  indicativeBudget?: {
    min: number;
    max: number;
    suggested: number;
    label: string;
  };
  indicativeDeadline?: {
    days: number;
    label: string;
  };
  deliverables?: string[];
  completenessScore?: number;
}

const MAX_INPUT = 4000;
const MAX_OUTPUT = 4000;

function lean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

type SectorBlueprint = {
  keywords: string[];
  projectType: "vitrine" | "e-commerce" | "landing page" | "app web" | "refonte";
  label: string;
  titlePrefix: string;
  features: string[];
  skills: string[];
  budget: { min: number; max: number; suggested: number; label: string };
  deadline: { days: number; label: string };
  deliverables: string[];
  suggestions: string[];
  questions: string[];
};

const BLUEPRINTS: SectorBlueprint[] = [
  {
    keywords: [
      "e-commerce",
      "boutique",
      "commerce",
      "panier",
      "vente en ligne",
      "paiement en ligne",
      "catalogue",
      "produits",
      "vendre",
    ],
    projectType: "e-commerce",
    label: "e-commerce",
    titlePrefix: "Création d’une boutique e-commerce",
    features: [
      "Galerie photos / vidéos",
      "Paiement mobile (Wave, Max It)",
      "Espace administrateur simple",
      "Bouton WhatsApp",
      "SEO local (Google)",
    ],
    skills: ["E-commerce", "Next.js / Shopify", "Paiement Mobile Money", "UI/UX Design", "SEO"],
    budget: {
      min: 200000,
      max: 800000,
      suggested: 350000,
      label: "200 000 – 800 000 FCFA (indicatif selon le nombre de produits)",
    },
    deadline: {
      days: 21,
      label: "2 à 4 semaines (environ 21 jours)",
    },
    deliverables: [
      "Boutique en ligne responsive (mobile et ordinateur)",
      "Catalogue produits avec gestion des stocks et catégories",
      "Intégration du parcours de commande (Wave / Orange Money / WhatsApp)",
      "Interface d’administration et formation à la prise en main",
    ],
    suggestions: [
      "Listez les produits ou services à vendre (nombre, catégories).",
      "Précisez le moyen de paiement : mobile money (Wave, Orange Money), carte bancaire…",
      "Indiquez le mode de livraison (votre ville, votre pays, export).",
      "Prévoyez un espace d'administration pour gérer produits et commandes.",
    ],
    questions: [
      "Combien de produits ou catégories souhaitez-vous intégrer au lancement ?",
      "Quels moyens de paiement souhaitez-vous proposer (Wave, Orange Money, paiement à la livraison) ?",
      "Disposez-vous déjà des photos produits et d’une charte graphique ?",
    ],
  },
  {
    keywords: [
      "vitrine",
      "entreprise",
      "présentation",
      "portfolio",
      "site vitrine",
      "cabinet",
      "agence",
      "école",
      "restaurant",
      "salon",
      "immobilier",
    ],
    projectType: "vitrine",
    label: "vitrine",
    titlePrefix: "Création d’un site vitrine professionnel",
    features: [
      "Galerie photos / vidéos",
      "Formulaire de contact",
      "Bouton WhatsApp",
      "Adresse & plan d’accès",
      "SEO local (Google)",
    ],
    skills: ["Développement Web", "Next.js / WordPress", "Responsive Design", "SEO local"],
    budget: {
      min: 80000,
      max: 300000,
      suggested: 150000,
      label: "80 000 – 300 000 FCFA (indicatif selon le nombre de pages)",
    },
    deadline: {
      days: 14,
      label: "1 à 2 semaines (environ 14 jours)",
    },
    deliverables: [
      "Site vitrine moderne adapté aux mobiles, tablettes et ordinateurs",
      "Pages structurées (Accueil, Services, À propos, Réalisations, Contact)",
      "Formulaire de demande de devis et bouton WhatsApp direct",
      "Optimisation SEO de base et mise en ligne sur votre domaine",
    ],
    suggestions: [
      "Décrivez vos activités et le message à faire passer.",
      "Indiquez les pages attendues : accueil, services, à propos, contact.",
      "Précisez si vous voulez un formulaire de devis ou une prise de rendez-vous.",
      "Pensez au référencement local (Google, WhatsApp) pour toucher vos clients.",
    ],
    questions: [
      "Quelles sont les pages principales que vous souhaitez présenter à vos visiteurs ?",
      "Souhaitez-vous intégrer une prise de rendez-vous ou une demande de devis en ligne ?",
      "Avez-vous déjà vos textes, votre logo et vos photos ?",
    ],
  },
  {
    keywords: [
      "landing",
      "page d'atterrissage",
      "promotion",
      "campagne",
      "pub",
      "annonce",
      "lancement",
    ],
    projectType: "landing page",
    label: "landing page",
    titlePrefix: "Conception d’une landing page orientée conversion",
    features: [
      "Formulaire de contact",
      "Bouton WhatsApp",
      "Galerie photos / vidéos",
      "SEO local (Google)",
    ],
    skills: ["Landing Page", "UI/UX Conversion", "Intégration Web", "Analytics"],
    budget: {
      min: 60000,
      max: 250000,
      suggested: 120000,
      label: "60 000 – 250 000 FCFA (indicatif)",
    },
    deadline: {
      days: 7,
      label: "5 à 10 jours (environ 7 jours)",
    },
    deliverables: [
      "Page unique haute conversion optimisée mobile",
      "Formulaire de capture de prospects et redirection WhatsApp",
      "Temps de chargement rapide et intégration des balises de suivi",
    ],
    suggestions: [
      "Fixez un objectif unique : inscription, achat, appel, WhatsApp…",
      "L'ensemble doit tenir sur une seule page, avec un appel à l'action clair.",
      "Prévoyez un formulaire simple et un suivi des conversions.",
    ],
    questions: [
      "Quel est l’objectif principal de la page (prise de contact, inscription, précommande) ?",
      "D’où proviendra le trafic (publicités Facebook/Instagram, WhatsApp, Google) ?",
      "Quelle est votre date de lancement souhaitée ?",
    ],
  },
  {
    keywords: [
      "application",
      "app mobile",
      "app web",
      "mobile",
      "web app",
      "saas",
      "plateforme",
      "logiciel",
      "gestion",
      "réservation",
    ],
    projectType: "app web",
    label: "application web",
    titlePrefix: "Développement d’une application web sur mesure",
    features: [
      "Réservation / prise de rendez-vous",
      "Paiement mobile (Wave, Max It)",
      "Espace administrateur simple",
      "Formulaire de contact",
    ],
    skills: ["Full-Stack", "React / Next.js", "Base de données / API", "Authentification"],
    budget: {
      min: 300000,
      max: 1200000,
      suggested: 600000,
      label: "300 000 – 1 200 000 FCFA (indicatif selon périmètre MVP)",
    },
    deadline: {
      days: 35,
      label: "4 à 6 semaines (environ 35 jours)",
    },
    deliverables: [
      "Application web sécurisée avec gestion des comptes utilisateurs",
      "Base de données et interface d’administration métier",
      "Déploiement en production et documentation technique",
      "Recette fonctionnelle et garantie de correction post-mise en ligne",
    ],
    suggestions: [
      "Décrivez les utilisateurs et leurs besoins (qui, pourquoi).",
      "Listez les fonctionnalités prioritaires (MVP) vs les futurs.",
      "Précisez si un espace de connexion / plusieurs rôles sont nécessaires.",
      "Indiquez les plateformes : mobile, tablette, ordinateur…",
    ],
    questions: [
      "Quels sont les différents types d’utilisateurs (clients, administrateurs, partenaires) ?",
      "Quelles sont les 3 fonctionnalités indispensables dès la première version (MVP) ?",
      "Faut-il connecter l’application à un service externe (SMS, WhatsApp, paiement mobile) ?",
    ],
  },
  {
    keywords: [
      "refonte",
      "redesign",
      "nouveau site",
      "changer",
      "remplacer",
      "moderniser",
    ],
    projectType: "refonte",
    label: "refonte",
    titlePrefix: "Refonte et modernisation de site web",
    features: [
      "Refonte de mon site existant",
      "Galerie photos / vidéos",
      "Formulaire de contact",
      "Bouton WhatsApp",
      "SEO local (Google)",
    ],
    skills: ["Refonte Web", "UI/UX Design", "Optimisation Performance", "Migration SEO"],
    budget: {
      min: 150000,
      max: 700000,
      suggested: 350000,
      label: "150 000 – 700 000 FCFA (indicatif selon l’existant)",
    },
    deadline: {
      days: 21,
      label: "2 à 3 semaines (environ 21 jours)",
    },
    deliverables: [
      "Audit de l’existant et nouvelle maquette responsive",
      "Reprise des contenus et redirections SEO sans perte de référencement",
      "Amélioration de la vitesse de chargement sur mobile",
      "Mise en production et formation à la mise à jour",
    ],
    suggestions: [
      "Partagez l'adresse du site actuel pour l'audit.",
      "Listez ce qui vous plaît et ce qui doit changer.",
      "Indiquez si le contenu et le nom de domaine sont conservés.",
    ],
    questions: [
      "Quelle est l’adresse actuelle de votre site web ?",
      "Quels sont les principaux problèmes rencontrés aujourd’hui (design, lenteur, affichage mobile) ?",
      "Souhaitez-vous conserver votre hébergement et votre nom de domaine actuels ?",
    ],
  },
];

function forcedImprovements(text: string): string {
  if (text.length < 40) {
    return text.replace(
      /\.?$/,
      ". Pour ce projet, précisez le périmètre, le budget indicatif et le délai souhaité."
    );
  }
  return text;
}

function detectMissingInfo(text: string): string[] {
  const lower = text.toLowerCase();
  const missing: string[] = [];
  if (!/\b(page|accueil|catalogue|produit|fonction|espace|formulaire|paiement|réservation)\b/.test(lower)) {
    missing.push("Fonctionnalités ou pages attendues non détaillées");
  }
  if (!/\b(semaine|jour|mois|urgent|date|délai|lancement)\b/.test(lower)) {
    missing.push("Délai ou date de mise en ligne souhaitée non précisés");
  }
  if (!/\b(charte|logo|photo|texte|contenu|maquette|design)\b/.test(lower)) {
    missing.push("Disponibilité des contenus (logo, textes, photos) non mentionnée");
  }
  if (!/\b(client|cible|utilisateur|entreprise|boutique|particulier)\b/.test(lower)) {
    missing.push("Public cible ou activité principale à préciser");
  }
  return missing;
}

function computeCompleteness(text: string, missingCount: number): number {
  const lenScore = Math.min(60, Math.round((text.length / 220) * 60));
  const detailBonus = Math.max(0, (4 - missingCount) * 10);
  return Math.min(100, Math.max(20, lenScore + detailBonus));
}

function formatByMode(
  cleaned: string,
  bp: SectorBlueprint,
  mode: AssistMode,
  answers?: Record<string, string>
): string {
  const answeredLines = Object.entries(answers ?? {})
    .map(([q, a]) => ({ q: q.trim(), a: a.trim() }))
    .filter((x) => x.a.length > 0);

  const answersBlock =
    answeredLines.length > 0
      ? "\n\nPrécisions complémentaires du client :\n" +
        answeredLines.map((x) => `- ${x.a}`).join("\n")
      : "";

  if (mode === "correct") {
    const cap = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    const ended = /[.!?]$/.test(cap) ? cap : `${cap}.`;
    return (ended + answersBlock).slice(0, MAX_OUTPUT);
  }

  if (mode === "simplify") {
    const base = forcedImprovements(cleaned);
    return (
      `Besoin principal : ${base}` +
      answersBlock +
      `\n\nLivrables attendus : ${bp.deliverables.slice(0, 2).join(" ; ")}.`
    ).slice(0, MAX_OUTPUT);
  }

  if (mode === "rewrite") {
    const base = forcedImprovements(cleaned);
    return (
      `Présentation du besoin :\n${base}` +
      answersBlock +
      `\n\nObjectif : réaliser un projet de type ${bp.label} adapté aux utilisateurs mobiles et ordinateurs.`
    ).slice(0, MAX_OUTPUT);
  }

  if (mode === "generate") {
    const base = forcedImprovements(cleaned);
    return (
      `Contexte et besoin du client :\n${base}` +
      answersBlock +
      `\n\nLivrables attendus (à valider avec le développeur) :\n` +
      bp.deliverables.map((d) => `- ${d}`).join("\n")
    ).slice(0, MAX_OUTPUT);
  }

  // mode === "improve" (compatibilité directe avec tests/brief-assistant.test.ts)
  return (forcedImprovements(cleaned) + answersBlock).slice(0, MAX_OUTPUT);
}

export function improveBriefWithRules(
  input: string,
  mode: AssistMode = "improve",
  answers?: Record<string, string>
): BriefAssistResult {
  const cleaned = lean(input || "").slice(0, MAX_OUTPUT);
  if (!cleaned) {
    return {
      description: "",
      suggestions: [
        "Commencez par une phrase d'accroche : qui vous êtes et ce que vous vendez.",
        "Donnez ensuite le livrable attendu (site, application, landing…) et sa durée idéale.",
        "Terminez par le budget indicatif : cela aide les développeurs à répondre vite.",
      ],
      source: "rules",
      mode,
      completenessScore: 0,
    };
  }

  const lowered = cleaned.toLowerCase();
  const matched =
    BLUEPRINTS.find((t) => t.keywords.some((k) => lowered.includes(k))) ??
    BLUEPRINTS[1];

  const missingInfo = detectMissingInfo(cleaned);
  const completenessScore = computeCompleteness(cleaned, missingInfo.length);
  const description = formatByMode(cleaned, matched, mode, answers);

  const suggestions = matched
    ? [
        `Ce brief semble porter sur un projet de type « ${matched.label} ».`,
        ...matched.suggestions,
      ]
    : [
        "Indiquez le type de projet : vitrine, e-commerce, landing page ou application web.",
        "Un budget indicatif et un délai aident les développeurs à répondre plus vite.",
        "Ajoutez tout document ou exemple utile (lien, maquette, nuancier).",
      ];

  return {
    description,
    suggestions,
    source: "rules",
    mode,
    understanding: `Projet identifié comme « ${matched.label} » à partir de votre description.`,
    missingInfo,
    questions: matched.questions,
    title: `${matched.titlePrefix} — ${cleaned.slice(0, 56)}${cleaned.length > 56 ? "…" : ""}`,
    projectType: matched.projectType,
    features: matched.features,
    skills: matched.skills,
    indicativeBudget: matched.budget,
    indicativeDeadline: matched.deadline,
    deliverables: matched.deliverables,
    completenessScore,
  };
}

async function callLlm(
  input: string,
  mode: AssistMode,
  fallback: BriefAssistResult,
  answers?: Record<string, string>
): Promise<BriefAssistResult | null> {
  const apiKey =
    process.env.AI_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return null;

  const baseUrl = (
    process.env.AI_BASE_URL ??
    (process.env.GROQ_API_KEY
      ? "https://api.groq.com/openai/v1"
      : "https://api.openai.com/v1")
  ).replace(/\/+$/, "");
  const model =
    process.env.AI_MODEL?.trim() ||
    (process.env.GROQ_API_KEY ? "llama-3.3-70b-versatile" : "gpt-4o-mini");

  const modeInstruction: Record<AssistMode, string> = {
    generate: "Génère un brief professionnel structuré et complet à partir des mots du client.",
    rewrite: "Réécris la demande du client dans un style professionnel, fluide et structuré.",
    correct: "Corrige uniquement l'orthographe, la grammaire et la syntaxe sans altérer le fond.",
    improve: "Améliore la clarté et la structure de la description du client.",
    simplify: "Simplifie la demande en phrases courtes, directes et immédiatement compréhensibles.",
  };

  const system = [
    "Tu es l'assistant IA de rédaction de briefs de Devmarket (marketplace de développement web).",
    modeInstruction[mode],
    "RÈGLE ABSOLUE : N'invente jamais d'exigences, de budget, de ville ou de délai présentés comme confirmés par le client.",
    "Réponds uniquement en JSON valide avec les clés :",
    "{",
    '  "understanding": string,',
    '  "title": string,',
    '  "projectType": "vitrine" | "e-commerce" | "landing page" | "app web" | "refonte",',
    '  "description": string,',
    '  "missingInfo": string[],',
    '  "questions": string[],',
    '  "features": string[],',
    '  "skills": string[],',
    '  "deliverables": string[],',
    '  "suggestions": string[]',
    "}",
  ].join(" ");

  const answersText =
    answers && Object.keys(answers).length > 0
      ? "\nRéponses du client aux questions :\n" +
        Object.entries(answers)
          .filter(([, v]) => v.trim())
          .map(([k, v]) => `- ${k} : ${v}`)
          .join("\n")
      : "";

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8500);
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        max_completion_tokens: 1100,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: (input.slice(0, MAX_INPUT) + answersText).slice(0, MAX_INPUT),
          },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return null;

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content) as Partial<BriefAssistResult> | null;

    if (!parsed || typeof parsed.description !== "string" || !parsed.description.trim()) {
      return null;
    }

    return {
      ...fallback,
      description: parsed.description.trim().slice(0, MAX_OUTPUT),
      title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : fallback.title,
      understanding:
        typeof parsed.understanding === "string" && parsed.understanding.trim()
          ? parsed.understanding.trim()
          : fallback.understanding,
      projectType:
        parsed.projectType &&
        ["vitrine", "e-commerce", "landing page", "app web", "refonte"].includes(parsed.projectType)
          ? parsed.projectType
          : fallback.projectType,
      missingInfo: Array.isArray(parsed.missingInfo)
        ? parsed.missingInfo.filter((s): s is string => typeof s === "string").slice(0, 5)
        : fallback.missingInfo,
      questions: Array.isArray(parsed.questions)
        ? parsed.questions.filter((s): s is string => typeof s === "string").slice(0, 4)
        : fallback.questions,
      features: Array.isArray(parsed.features)
        ? parsed.features.filter((s): s is string => typeof s === "string").slice(0, 6)
        : fallback.features,
      skills: Array.isArray(parsed.skills)
        ? parsed.skills.filter((s): s is string => typeof s === "string").slice(0, 6)
        : fallback.skills,
      deliverables: Array.isArray(parsed.deliverables)
        ? parsed.deliverables.filter((s): s is string => typeof s === "string").slice(0, 5)
        : fallback.deliverables,
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.filter((s): s is string => typeof s === "string").slice(0, 4)
        : fallback.suggestions,
      source: "llm",
      mode,
    };
  } catch {
    return null;
  }
}

export async function improveBriefDescription(
  input: string,
  mode: AssistMode = "improve",
  answers?: Record<string, string>
): Promise<BriefAssistResult> {
  const rules = improveBriefWithRules(input, mode, answers);
  const llm = await callLlm(input, mode, rules, answers);
  if (llm) return llm;
  return rules;
}
