import type { ProjectType } from "@/types/database";
import { PROJECT_TYPE_LABELS } from "@/lib/tokens";
import { formatFCFA } from "@/lib/formatting";

export const PROJECT_TYPE_KEYWORDS: Record<ProjectType, string[]> = {
  vitrine: ["vitrine", "site vitrine", "site statique", "wordpress"],
  "e-commerce": ["e-commerce", "ecommerce", "boutique en ligne", "woocommerce", "shopify"],
  "landing page": ["landing page", "landing", "page de vente"],
  "app web": ["app web", "application", "web app"],
  refonte: ["refonte", "nouveau site", "refaire", "moderniser"],
};

export function keywordsForType(projectType: string): string[] {
  return PROJECT_TYPE_KEYWORDS[projectType as ProjectType] ?? [];
}

export type BriefSummary = {
  client_name: string;
  client_city: string;
  project_type: string;
  budget: number;
};

/** Résumé linéaire : « Landing page · Dakar · 250 000 FCFA ». */
export function summarizeBrief(brief: BriefSummary): string {
  const type = PROJECT_TYPE_LABELS[brief.project_type] ?? brief.project_type;
  return `${type} · ${brief.client_city} · ${formatFCFA(brief.budget)}`;
}

export type ClientConfirmationPayload = BriefSummary & {
  request_id: string;
  client_whatsapp: string;
  management_key: string;
};

export function buildClientConfirmationMessage(
  brief: ClientConfirmationPayload,
  origin: string
): string {
  const trackingUrl = `${origin}/brief/${brief.request_id}?key=${brief.management_key}`;
  return (
    `Teranga Labs : votre brief « ${brief.client_name} » est en ligne !\n` +
    `\n` +
    `${summarizeBrief(brief)}\n` +
    `\n` +
    `Suivez les développeurs intéressés et laissez un avis depuis votre espace client :\n` +
    `${trackingUrl}\n` +
    `\n` +
    `Ce lien est personnel, ne le partagez pas.`
  );
}

export type DeveloperMatchPayload = BriefSummary & {
  request_id: string;
};

export function buildDeveloperMatchMessage(
  brief: DeveloperMatchPayload,
  origin: string
): string {
  return (
    `Nouveau brief sur Teranga Labs :\n` +
    `${summarizeBrief(brief)}\n` +
    `Consultez le projet et débloquez le contact du client :\n` +
    `${origin}/briefs`
  );
}