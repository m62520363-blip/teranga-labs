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
  pending: "En attente d’approbation",
  active: "Validé",
  verification_pending: "Vérification en cours",
  verified: "Vérifié",
  rejected: "Rejeté",
  changes_requested: "Modifications demandées",
  suspended: "Suspendu",
};

export const DEVELOPER_SERVICES = [
  "Site vitrine",
  "Boutique en ligne",
  "Application web sur mesure",
  "Application mobile",
  "Landing page",
  "Refonte de site",
  "Maintenance & support",
  "UI / UX Design",
  "Branding & identité visuelle",
  "Rédaction & SEO",
] as const;

export const EXPERIENCE_LEVELS = [
  { value: "debutant", label: "Débutant (0–1 an)" },
  { value: "intermediaire", label: "Intermédiaire (1–3 ans)" },
  { value: "avance", label: "Avancé (3–6 ans)" },
  { value: "expert", label: "Expert (6+ ans)" },
] as const;

export const AVAILABILITY_OPTIONS = [
  { value: "available_now", label: "Disponible immédiatement" },
  { value: "available_soon", label: "Disponible sous peu" },
  { value: "on_mission", label: "En mission" },
] as const;

export const DOCUMENT_KINDS = [
  { value: "cv", label: "CV" },
  { value: "professional", label: "Document professionnel" },
  { value: "other", label: "Autre" },
] as const;

export const LINK_KINDS = [
  { value: "github", label: "GitHub" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "other", label: "Autre lien" },
] as const;

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