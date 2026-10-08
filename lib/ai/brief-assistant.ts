/**
 * Assistant IA pour la rédaction d'un brief (§ P2-5).
 *
 * - Mode "règles" (fallback, toujours disponible) : nettoyage et
 *   reformulation légère + suggestions calibrées sur le secteur
 *   (vitrine, e-commerce, landing page, application web, refonte…).
 * - Mode "LLM optionnel" : si AI_API_KEY / AI_BASE_URL / AI_MODEL
 *   sont définis, envoie la description à un endpoint compatible
 *   OpenAI (chat completions) et retourne description réécrite +
 *   suggestions. Tout échec de l'appel (timeout, réseau, 4xx/5xx)
 *   retombe proprement sur le mode règles.
 */

export interface BriefAssistResult {
  description: string;
  suggestions: string[];
  source: "llm" | "rules";
}

const MAX_INPUT = 4000;
const MAX_OUTPUT = 4000;

function lean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

const TYPE_HINTS: { keywords: string[]; label: string; suggestions: string[] }[] = [
  {
    keywords: ["e-commerce", "boutique", "commerce", "panier", "vente en ligne", "paiement en ligne"],
    label: "e-commerce",
    suggestions: [
      "Listez les produits ou services à vendre (nombre, catégories).",
      "Précisez le moyen de paiement : mobile money (Wave, Orange Money), carte bancaire…",
      "Indiquez le mode de livraison (Dakar, régions, Sénégal, export).",
      "Prévoyez un espace d'administration pour gérer produits et commandes.",
    ],
  },
  {
    keywords: ["vitrine", "entreprise", "présentation", "portfolio", "site vitrine"],
    label: "vitrine",
    suggestions: [
      "Décrivez vos activités et le message à faire passer.",
      "Indiquez les pages attendues : accueil, services, à propos, contact.",
      "Précisez si vous voulez un formulaire de devis ou une prise de rendez-vous.",
      "Pensez au référencement local (Google, WhatsApp) pour toucher vos clients.",
    ],
  },
  {
    keywords: ["landing", "page d'atterrissage", "promotion", "campagne", "pub", "annonce"],
    label: "landing page",
    suggestions: [
      "Fixez un objectif unique : inscription, achat, appel, WhatsApp…",
      "L'ensemble doit tenir sur une seule page, avec un appel à l'action clair.",
      "Prévoyez un formulaire simple et un suivi des conversions.",
    ],
  },
  {
    keywords: ["application", "app mobile", "app web", "mobile", "web app", "saas"],
    label: "application web",
    suggestions: [
      "Décrivez les utilisateurs et leurs besoins (qui, pourquoi).",
      "Listez les fonctionnalités prioritaires (MVP) vs les futurs.",
      "Précisez si un espace de connexion / plusieurs rôles sont nécessaires.",
      "Indiquez les plateformes : mobile, tablette, ordinateur…",
    ],
  },
  {
    keywords: ["refonte", "redesign", "nouveau site", "changer", "remplacer"],
    label: "refonte",
    suggestions: [
      "Partagez l'adresse du site actuel pour l'audit.",
      "Listez ce qui vous plaît et ce qui doit changer.",
      "Indiquez si le contenu et le nom de domaine sont conservés.",
    ],
  },
];

export function improveBriefWithRules(input: string): BriefAssistResult {
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
    };
  }

  const lowered = cleaned.toLowerCase();
  const matched = TYPE_HINTS.find((t) =>
    t.keywords.some((k) => lowered.includes(k))
  );

  const description = forcedImprovements(cleaned);
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

  return { description, suggestions, source: "rules" };
}

function forcedImprovements(text: string): string {
  if (text.length < 40) {
    return text.replace(
      /\.?$/,
      ". Pour ce projet, précisez le périmètre, le budget indicatif et le délai souhaité."
    );
  }
  return text;
}

async function callLlm(input: string): Promise<BriefAssistResult | null> {
  const apiKey = process.env.AI_API_KEY?.trim();
  const baseUrl = (process.env.AI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = process.env.AI_MODEL?.trim() || "gpt-4o-mini";
  if (!apiKey) return null;

  const system = [
    "Tu es un assistant de rédaction pour un marketplace de développement web africain.",
    "Reformule la description du projet du client en français : clair, complet, structuré.",
    "Ne fabrique jamais d'informations (pas de budget, ville ou délai inventés).",
    "Réponds uniquement en JSON : {\"description\": string, \"suggestions\": string[]}.",
  ].join(" ");

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_completion_tokens: 900,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: input.slice(0, MAX_INPUT),
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
    const parsed = JSON.parse(content) as {
      description?: string;
      suggestions?: string[];
    } | null;

    if (!parsed || typeof parsed.description !== "string" || !parsed.description.trim()) {
      return null;
    }

    return {
      description: lean(parsed.description).slice(0, MAX_OUTPUT),
      suggestions: (
        Array.isArray(parsed.suggestions)
          ? parsed.suggestions.filter((s): s is string => typeof s === "string")
          : []
      )
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 4),
      source: "llm",
    };
  } catch {
    return null;
  }
}

export async function improveBriefDescription(input: string): Promise<BriefAssistResult> {
  const rules = improveBriefWithRules(input);
  const llm = await callLlm(input);
  if (llm) return llm;
  return rules;
}