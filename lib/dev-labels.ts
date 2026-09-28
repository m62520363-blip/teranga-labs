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