const fcfaFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
});

export function formatFCFA(amount: number): string {
  return `${fcfaFormatter.format(amount)} FCFA`;
}

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