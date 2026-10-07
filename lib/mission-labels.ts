import type { MissionStatus } from "@/types/database";

export const MISSION_STATUS_LABELS: Record<
  MissionStatus,
  { label: string; short: string; badge: string }
> = {
  new: { label: "Nouvelle mission", short: "Nouvelle", badge: "badge badge-muted" },
  in_progress: { label: "Mission en cours", short: "En cours", badge: "badge badge-warning" },
  completed: { label: "Mission terminée", short: "Terminée", badge: "badge badge-success" },
  disputed: { label: "Litige ouvert", short: "Litige", badge: "inline-flex items-center rounded-full bg-error-soft px-2 py-0.5 text-[11px] font-semibold text-error" },
  cancelled: { label: "Mission annulée", short: "Annulée", badge: "badge badge-muted" },
};

export const MISSION_ERRORS: Record<string, string> = {
  TLNAU: "Connectez-vous pour continuer.",
  TLNFO: "Offre introuvable.",
  TLNOC: "Seul le client concerné peut créer la mission.",
  TLPEN: "L'offre doit d'abord être acceptée.",
  TLDUP: "Une mission existe déjà pour cette offre.",
  TLNMI: "Mission introuvable.",
  TLTRN: "Transition de statut invalide pour votre rôle.",
  TLAAC: "Accès refusé.",
};

export function missionErrorMessage(code: string | null, fallback: string): string {
  if (code && MISSION_ERRORS[code]) return MISSION_ERRORS[code];
  return fallback;
}

export const MISSION_TRANSITIONS: Record<
  MissionStatus,
  { to: MissionStatus; label: string; by: "developer" | "client"; confirm?: boolean; comment?: boolean }[]
> = {
  new: [
    { to: "in_progress", label: "Démarrer la mission", by: "developer" },
    { to: "cancelled", label: "Annuler", by: "client", confirm: true },
    { to: "disputed", label: "Ouvrir un litige", by: "client", confirm: true },
  ],
  in_progress: [
    { to: "completed", label: "Terminer la mission", by: "developer", comment: true },
    { to: "disputed", label: "Ouvrir un litige", by: "client", confirm: true },
    { to: "cancelled", label: "Annuler", by: "client", confirm: true },
  ],
  completed: [
    { to: "disputed", label: "Ouvrir un litige", by: "client", confirm: true },
  ],
  disputed: [],
  cancelled: [],
};