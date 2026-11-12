export const AVAILABILITY_LABELS: Record<string, { label: string; badge: string }> = {
  available_now: { label: "Disponible immédiatement", badge: "badge-success" },
  available_soon: { label: "Disponible bientôt", badge: "badge-warning" },
  on_mission: { label: "En mission", badge: "badge-muted" },
};

export function availabilityInfo(value: string | null | undefined) {
  if (!value) return { label: "Disponibilité inconnue", badge: "badge-muted" };
  return (
    AVAILABILITY_LABELS[value] ?? {
      label: "Disponibilité inconnue",
      badge: "badge-muted",
    }
  );
}

export const EXPERIENCE_LEVEL_LABELS: Record<string, string> = {
  junior: "Junior",
  intermediate: "Intermédiaire",
  senior: "Senior",
};

export function experienceLabel(value: string | null | undefined) {
  if (!value) return "Développeur indépendant";
  return EXPERIENCE_LEVEL_LABELS[value] ?? value;
}

/** Filtre « Classement » : seuil de points minimum (missions × 50 + réputation). */
export const RANKING_FILTER_OPTIONS = [
  { value: "0", label: "Tous les classements" },
  { value: "50", label: "50 points et plus" },
  { value: "100", label: "100 points et plus" },
  { value: "250", label: "250 points et plus" },
  { value: "500", label: "500 points et plus" },
];

/** Niveaux de réputation → libellés lisibles. */
export const REPUTATION_LEVEL_LABELS: Record<string, string> = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
  expert: "Expert",
};

export function reputationLevelLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  // Valeur inconnue (donnée obsolète ou fantôme) : on n'affiche rien
  // plutôt que du texte non maîtrisé.
  return REPUTATION_LEVEL_LABELS[value.trim().toLowerCase()] ?? null;
}

export const SORT_OPTIONS = [
  { value: "relevance", label: "Meilleurs résultats" },
  { value: "experience", label: "Expérience décroissante" },
  { value: "projects", label: "Projets réalisés" },
  { value: "rating", label: "Meilleures notes" },
  { value: "availability", label: "Disponibilité" },
];

export const TECH_TAGS = [
  "react",
  "next.js",
  "node.js",
  "javascript",
  "typescript",
  "php",
  "laravel",
  "symfony",
  "python",
  "django",
  "flutter",
  "wordpress",
  "vue",
  "angular",
  "tailwind",
  "mysql",
  "postgresql",
  "mongodb",
  "docker",
  "aws",
  "firebase",
  "supabase",
  "strapi",
];