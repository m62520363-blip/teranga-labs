import type { MissionStatus } from "@/types/database";

export const MISSION_STATUS_LABELS: Record<
  MissionStatus,
  { label: string; short: string; badge: string }
> = {
  draft: { label: "Brouillon", short: "Brouillon", badge: "badge badge-muted" },
  negotiating: { label: "Négociation", short: "Négociation", badge: "badge badge-muted" },
  awaiting_agreement: { label: "En attente d'accord", short: "Accord", badge: "badge badge-muted" },
  awaiting_payment: { label: "En attente de paiement", short: "Paiement", badge: "badge badge-warning" },
  payment_confirmed: { label: "Paiement confirmé", short: "Payé", badge: "badge badge-warning" },
  in_progress: { label: "En cours", short: "En cours", badge: "badge badge-warning" },
  delivery_submitted: { label: "Livraison soumise", short: "Livré", badge: "badge badge-warning" },
  awaiting_acceptance: { label: "En attente d'acceptation", short: "Acceptation", badge: "badge badge-warning" },
  corrections_requested: { label: "Corrections demandées", short: "Corrections", badge: "badge badge-warning" },
  dispute_open: { label: "Litige ouvert", short: "Litige", badge: "inline-flex items-center rounded-full bg-error-soft px-2 py-0.5 text-[11px] font-semibold text-error" },
  completed: { label: "Terminée", short: "Terminée", badge: "badge badge-success" },
  cancellation_requested: { label: "Annulation demandée", short: "Annulation", badge: "badge badge-muted" },
  cancelled: { label: "Annulée", short: "Annulée", badge: "badge badge-muted" },
  refund_in_progress: { label: "Remboursement en cours", short: "Remboursement", badge: "badge badge-muted" },
  refunded: { label: "Remboursée", short: "Remboursée", badge: "badge badge-muted" },
  new: { label: "Nouvelle mission", short: "Nouvelle", badge: "badge badge-muted" },
  disputed: { label: "Litige ouvert", short: "Litige", badge: "inline-flex items-center rounded-full bg-error-soft px-2 py-0.5 text-[11px] font-semibold text-error" },
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
  TLSTS: "Le statut de la mission ne permet pas cette action.",
  TLDSP: "Un litige est en cours.",
  TLBAD: "Données invalides.",
};

export function missionErrorMessage(code: string | null, fallback: string): string {
  if (code && MISSION_ERRORS[code]) return MISSION_ERRORS[code];
  return fallback;
}

export const MISSION_TRANSITIONS: Record<
  MissionStatus,
  { to: MissionStatus; label: string; by: "developer" | "client"; confirm?: boolean; comment?: boolean }[]
> = {
  draft: [
    { to: "negotiating", label: "Commencer la négociation", by: "developer" },
    { to: "cancelled", label: "Annuler", by: "client", confirm: true },
  ],
  negotiating: [
    { to: "awaiting_agreement", label: "Proposer un accord", by: "developer" },
    { to: "cancelled", label: "Annuler", by: "client", confirm: true },
  ],
  awaiting_agreement: [
    { to: "awaiting_payment", label: "Accepter l'accord", by: "client", confirm: true },
    { to: "cancelled", label: "Annuler", by: "client", confirm: true },
  ],
  awaiting_payment: [
    { to: "payment_confirmed", label: "Paiement confirmé", by: "client" },
    { to: "cancellation_requested", label: "Demander l'annulation", by: "client", confirm: true, comment: true },
  ],
  payment_confirmed: [
    { to: "in_progress", label: "Démarrer la mission", by: "developer" },
    { to: "cancellation_requested", label: "Demander l'annulation", by: "client", confirm: true, comment: true },
    { to: "dispute_open", label: "Ouvrir un litige", by: "client", confirm: true, comment: true },
  ],
  in_progress: [
    { to: "delivery_submitted", label: "Soumettre la livraison", by: "developer" },
    { to: "cancellation_requested", label: "Demander l'annulation", by: "client", confirm: true, comment: true },
    { to: "dispute_open", label: "Ouvrir un litige", by: "client", confirm: true, comment: true },
  ],
  delivery_submitted: [
    { to: "awaiting_acceptance", label: "Confirmer la livraison", by: "developer" },
    { to: "completed", label: "Accepter la livraison", by: "client", confirm: true },
    { to: "corrections_requested", label: "Demander des corrections", by: "client", confirm: true, comment: true },
    { to: "dispute_open", label: "Ouvrir un litige", by: "client", confirm: true, comment: true },
  ],
  awaiting_acceptance: [
    { to: "completed", label: "Accepter la livraison", by: "client", confirm: true },
    { to: "corrections_requested", label: "Demander des corrections", by: "client", confirm: true, comment: true },
    { to: "dispute_open", label: "Ouvrir un litige", by: "client", confirm: true, comment: true },
  ],
  corrections_requested: [
    { to: "in_progress", label: "Reprendre le travail", by: "developer" },
    { to: "cancellation_requested", label: "Demander l'annulation", by: "client", confirm: true, comment: true },
    { to: "dispute_open", label: "Ouvrir un litige", by: "client", confirm: true, comment: true },
  ],
  dispute_open: [
    { to: "completed", label: "Résoudre en faveur du client", by: "client", confirm: true },
  ],
  completed: [],
  cancellation_requested: [
    { to: "cancelled", label: "Confirmer l'annulation", by: "client", confirm: true },
  ],
  cancelled: [],
  refund_in_progress: [
    { to: "refunded", label: "Confirmer le remboursement", by: "client", confirm: true },
  ],
  refunded: [],
  new: [
    { to: "in_progress", label: "Démarrer la mission", by: "developer" },
    { to: "cancelled", label: "Annuler", by: "client", confirm: true },
    { to: "disputed", label: "Ouvrir un litige", by: "client", confirm: true },
  ],
  disputed: [],
};
