export const SENEGAL_REGIONS = [
  "Dakar",
  "Diourbel",
  "Fatick",
  "Kaffrine",
  "Kaolack",
  "Kédougou",
  "Kolda",
  "Louga",
  "Matam",
  "Saint-Louis",
  "Sédhiou",
  "Tambacounda",
  "Thiès",
  "Ziguinchor",
] as const;

export const PROJECT_TYPES = [
  "vitrine",
  "e-commerce",
  "landing page",
  "app web",
  "refonte",
] as const;

export const PROJECT_TYPE_LABELS: Record<string, string> = {
  vitrine: "Vitrine",
  "e-commerce": "E-commerce",
  "landing page": "Landing page",
  "app web": "App web",
  refonte: "Refonte",
};

export function normalizeWhatsApp(raw: string): string {
  const digits = raw.replace(/[\s\-.()+]/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("+")) return digits.slice(1);
  if (digits.startsWith("0") && digits.length === 10) {
    return `221${digits.slice(1)}`;
  }
  return digits;
}

export function waLink(whatsapp: string): string {
  return `https://wa.me/${normalizeWhatsApp(whatsapp)}`;
}

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  ouvert: "Ouvert",
  attribué: "Attribué",
  terminé: "Terminé",
  fermé: "Fermé",
};

export const DEVELOPER_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  active: "Validé",
  rejected: "Rejeté",
  suspended: "Suspendu",
};

export const REPORT_REASONS = [
  "Fausse demande",
  "Informations trompeuses",
  "Harcèlement ou spam",
  "Contenu inapproprié",
  "Fraude / tentative d'arnaque",
  "Autre",
] as const;

export function decodeUnlockError(
  code: string | null,
  fallback: string
): string {
  switch (code) {
    case "TLNAU":
      return "Vous devez être connecté pour débloquer un contact.";
    case "TLNOD":
      return "Créez d'abord un compte développeur.";
    case "TLPEN":
      return "Votre compte développeur est en attente de validation par notre équipe.";
    case "TLRJC":
      return "Votre compte développeur ne permet pas de débloquer des contacts.";
    case "TLNOR":
      return "Ce brief n'existe plus.";
    case "TLCLO":
      return "Ce brief n'est plus disponible.";
    case "TLDUP":
      return "Vous avez déjà débloqué ce contact.";
    case "TLLOW":
      return "Tokens insuffisants. Rechargez vos Tokens.";
    case "TLAAC":
      return "Accès non autorisé.";
    case "TLNOP":
      return "Pack de Tokens introuvable.";
    case "TLNOK":
      return "Lien de gestion invalide.";
    case "TLSPM":
      return "Un signalement est déjà en cours pour ce contenu.";
    default:
      return fallback;
  }
}