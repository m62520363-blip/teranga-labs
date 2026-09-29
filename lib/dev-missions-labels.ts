export const PROJECT_TYPES = [
  { value: "vitrine", label: "Site vitrine" },
  { value: "app web", label: "Application web" },
  { value: "e-commerce", label: "E-commerce" },
  { value: "saas", label: "SaaS" },
  { value: "marketplace", label: "Marketplace" },
  { value: "dashboard", label: "Dashboard" },
  { value: "app mobile", label: "Application mobile" },
  { value: "api", label: "API" },
  { value: "automatisation", label: "Automatisation" },
  { value: "ia", label: "IA" },
  { value: "landing page", label: "Landing page" },
  { value: "refonte", label: "Refonte" },
  { value: "autre", label: "Autre" },
] as const;

export function projectTypeLabel(value: string | null | undefined): string {
  if (!value) return "Projet";
  const found = PROJECT_TYPES.find((t) => t.value === value);
  if (found) return found.label;
  return value
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function formatProjectDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
  });
}

export const MISSION_STATUS_LABELS: Record<string, string> = {
  pending: "En attente de vérification",
  verified: "Mission vérifiée",
  corrections: "Informations à corriger",
  rejected: "Mission refusée",
};

export function missionStatusBadge(
  status: string
): "success" | "warning" | "danger" | "muted" {
  if (status === "verified") return "success";
  if (status === "corrections") return "warning";
  if (status === "rejected") return "danger";
  return "muted";
}

export const PUBLICATION_LABELS: Record<string, string> = {
  public: "Projet public",
  confidential: "Projet confidentiel",
  clients_only: "Visible uniquement par les clients TERANGA LABS",
};

export function publicationLabel(
  value: string | null | undefined
): string {
  if (!value) return PUBLICATION_LABELS.public;
  return PUBLICATION_LABELS[value] ?? PUBLICATION_LABELS.public;
}

export function formatDuration(value: string | null | undefined): string {
  if (!value) return "";
  return value;
}