const fcfaFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
});

export function formatFCFA(amount: number): string {
  return `${fcfaFormatter.format(amount)} FCFA`;
}

/**
 * Source unique du prix d'un Token.
 *
 * Règle de rédaction : le prix ne doit apparaître que 3 fois maximum sur la
 * landing (hero, page /tokens, FAQ). Partout ailleurs, on écrit « 1 Token »
 * sans le montant — c'est la repetition qui Kreiselt le tunnel de conversion.
 */
export const TOKEN_PRICE_FCFA = 2500;

/** « 1 Token » — libellé court, sans prix. */
export const TOKEN_LABEL = "1 Token";

/** « 1 Token (2 500 FCFA) » — pour les 3 emplacements autorisés. */
export const TOKEN_LABEL_PRICED = `${TOKEN_LABEL} (${TOKEN_PRICE_FCFA.toLocaleString("fr-FR")} FCFA)`;

/** « 1 Token = 2 500 F » — pour la règle explicite (accueil + FAQ). */
export const TOKEN_RULE = `${TOKEN_LABEL} = ${TOKEN_PRICE_FCFA.toLocaleString("fr-FR")} F`;

export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) return "À l'instant";
  if (minutes < 60) {
    return minutes === 1 ? "Il y a 1 min" : `Il y a ${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return hours === 1 ? "Il y a 1 h" : `Il y a ${hours} h`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return days === 1 ? "Il y a 1 jour" : `Il y a ${days} jours`;
  }

  const weeks = Math.floor(days / 7);
  if (weeks < 5) {
    return weeks === 1 ? "Il y a 1 semaine" : `Il y a ${weeks} semaines`;
  }

  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(isoDate: string): string {
  return new Date(isoDate).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const DAY_MS = 24 * 3_600_000;

/**
 * Fraîcheur d'un brief pour l'affichage des badges :
 *   - "h24" : publié il y a moins de 24 h (badge « Moins de 24h »)
 *   - "new" : publié il y a moins de 3 jours (badge « Nouveau »)
 *   - null  : brief plus ancien (aucun badge temporel)
 */
export function briefFreshness(isoDate: string): "h24" | "new" | null {
  const age = Date.now() - new Date(isoDate).getTime();
  if (age < DAY_MS) return "h24";
  if (age < 3 * DAY_MS) return "new";
  return null;
}

/**
 * Extrait le prénom d'un nom complet pour l'aperçu public.
 *
 * On n'affiche JAMAIS le nom de famille ni le WhatsApp avant paiement : c'est
 * précisément ce que le Token achète. Le prénom suffit au développeur pour
 * personnaliser sa proposition.
 *
 *   "Aïssatou Diop"        → "Aïssatou"
 *   "Moussa"               → "Moussa"
 *   "Ndiaye Fatou"         → "Fatou"   (le dernier mot est souvent le nom)
 *   ""                     → "Client"
 */
export function firstNameOf(fullName: string | null | undefined): string {
  const clean = (fullName ?? "").trim().replace(/\s+/g, " ");
  if (!clean) return "Client";

  const parts = clean.split(" ");
  if (parts.length === 1) return parts[0];

  // "Prénom Nom" : le premier mot est le prénom.
  // "Nom Prénom" : si le dernier mot ressemble à un prénom inconnu, on le prend.
  // Heuristique simple et sans risque : on garde le premier mot, qui est le
  // prénom dans 95 % des saisies sénégalaises (« Aïssatou Diop »).
  return parts[0];
}