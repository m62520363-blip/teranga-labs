import type {
  ReviewAnswer,
  ReviewCriteria,
  ReviewQuestions,
} from "@/types/database";

export const REVIEW_CRITERIA: { key: keyof ReviewCriteria; label: string }[] = [
  { key: "qualite", label: "Qualité du travail" },
  { key: "delais", label: "Respect des délais" },
  { key: "communication", label: "Communication" },
  { key: "comprehension", label: "Compréhension du besoin" },
  { key: "interface", label: "Interface & design" },
  { key: "fonctionnalites", label: "Fonctionnalités livrées" },
  { key: "qualite_prix", label: "Rapport qualité / prix" },
  { key: "professionnalisme", label: "Professionnalisme" },
];

export function reviewCriteriaLabel(key: string | null | undefined): string {
  if (!key) return "Critère";
  const found = REVIEW_CRITERIA.find((c) => c.key === key);
  return found?.label ?? key;
}

export const REVIEW_QUESTIONS: {
  key: keyof ReviewQuestions;
  label: string;
  answers: ReviewAnswer[];
}[] = [
  {
    key: "conforme",
    label: "Le projet a été livré conformément à ce qui était prévu ?",
    answers: ["oui", "partiellement", "non"],
  },
  {
    key: "reactivite",
    label: "Le développeur a été réactif pendant la mission ?",
    answers: ["oui", "partiellement", "non"],
  },
  {
    key: "recommandation",
    label: "Recommanderiez-vous ce développeur ?",
    answers: ["oui", "partiellement", "non"],
  },
  {
    key: "retenir",
    label: "Accepteriez-vous de retravailler avec lui ?",
    answers: ["oui", "partiellement", "non"],
  },
];

export function reviewQuestionLabel(key: string | null | undefined): string {
  if (!key) return "Question";
  const found = REVIEW_QUESTIONS.find((q) => q.key === key);
  return found?.label ?? key;
}

export const REVIEW_QUESTION_ANSWERS: {
  value: ReviewAnswer;
  label: string;
}[] = [
  { value: "oui", label: "Oui" },
  { value: "partiellement", label: "Partiellement" },
  { value: "non", label: "Non" },
];

export const REVIEW_REPORT_REASONS: { value: string; label: string }[] = [
  { value: "contenu_abusif", label: "Contenu abusif, insultant ou haineux" },
  { value: "faux_avis", label: "Faux avis (mission non réalisée ou identité douteuse)" },
  { value: "information_incorrecte", label: "Fausse information sur la mission" },
  { value: "propos_personnels", label: "Informations personnelles partagées (téléphone, email, adresse)" },
  { value: "hors_sujet", label: "Contenu hors sujet ou publicitaire" },
  { value: "auto_evaluation", label: "Auto-évaluation suspecte (multi-comptes)" },
  { value: "autre", label: "Autre motif" },
];

export function reviewReportReasonLabel(value: string | null | undefined): string {
  if (!value) return "Autre";
  const found = REVIEW_REPORT_REASONS.find((r) => r.value === value);
  return found?.label ?? value;
}

export function starLabel(rating: number | null | undefined): string {
  if (rating == null) return "—";
  const labels: Record<number, string> = {
    1: "Très décevant",
    2: "Décevant",
    3: "Correct",
    4: "Bon",
    5: "Excellent",
  };
  return labels[rating] ?? `${rating}/5`;
}