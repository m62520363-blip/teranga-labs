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

/**
 * Normalise un numéro pour un lien wa.me / un identifiant WhatsApp : on retire
 * les séparateurs, le « + » et le préfixe international « 00 ».
 *
 * On ne force plus jamais d'indicatif pays : le champ `PhoneInput` fait
 * toujours précéder le numéro de l'indicatif sélectionné (ex. `+221`,
 * `+223`, `+225`…), donc la partie nationale est déjà complète. Deviner un
 * pays à partir d'un numéro « 0… » local serait faux hors Sénégal.
 */
export function normalizeWhatsApp(raw: string): string {
  const digits = raw.replace(/[\s\-.()+]/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
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
      return "Ce projet n'existe plus.";
    case "TLCLO":
      return "Ce projet n'est plus disponible.";
    case "TLDUP":
      return "Vous avez déjà envoyé une proposition sur ce projet.";
    case "TLLOW":
    case "TLQUO":
      return "Crédits de contacts mensuels insuffisants sur votre formule actuelle. Passez à une formule supérieure.";
    case "TLAAC":
      return "Accès non autorisé.";
    case "TLNOP":
      return "Formule d’abonnement introuvable.";
    case "TLNOK":
      return "Lien de gestion invalide.";
    case "TLSPM":
      return "Un signalement est déjà en cours pour ce contenu.";
    default:
      return fallback;
  }
}