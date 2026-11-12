/**
 * Catalogue des compétences et spécialités DevMarket.
 *
 * - Les compétences (skills) sont les technologies, outils, langages.
 * - Les spécialités (specialties) sont les domaines professionnels.
 *
 * Ces listes sont la source unique de vérité. Le développeur ne peut
 * sélectionner que les éléments proposés ici (pas de saisie libre).
 */

export type SkillCategory = {
  name: string;
  skills: string[];
};

export const SKILL_CATEGORIES: SkillCategory[] = [
  {
    name: "Développement web",
    skills: [
      "HTML", "CSS", "JavaScript", "TypeScript", "React", "Next.js",
      "Vue.js", "Angular", "Node.js", "PHP", "Laravel", "Symfony",
      "Python", "Django", "Flask", "Java", "Spring Boot", "C#",
      "ASP.NET", "Ruby", "Ruby on Rails", "WordPress", "Webflow", "Shopify",
    ],
  },
  {
    name: "Développement mobile",
    skills: ["Flutter", "Dart", "React Native", "Kotlin", "Swift", "Android", "iOS"],
  },
  {
    name: "Bases de données",
    skills: ["MySQL", "PostgreSQL", "MongoDB", "SQLite", "Redis", "Firebase", "Supabase"],
  },
  {
    name: "Design et interfaces",
    skills: ["Figma", "Adobe XD", "Photoshop", "Illustrator", "UI Design", "UX Design", "Prototypage"],
  },
  {
    name: "IA et données",
    skills: ["Machine Learning", "Deep Learning", "Data Analysis", "TensorFlow", "PyTorch", "Data Science"],
  },
  {
    name: "DevOps et infrastructure",
    skills: ["Docker", "Kubernetes", "Git", "GitHub", "Linux", "AWS", "Azure", "Google Cloud", "CI/CD"],
  },
  {
    name: "Cybersécurité",
    skills: ["Sécurité informatique", "Audit de sécurité", "Sécurité réseau", "Pentesting", "Cryptographie"],
  },
];

export const ALL_SKILLS: string[] = SKILL_CATEGORIES.flatMap((c) => c.skills);

export type Specialty = {
  value: string;
  label: string;
};

export const SPECIALTIES: Specialty[] = [
  { value: "frontend", label: "Développeur Front-end" },
  { value: "backend", label: "Développeur Back-end" },
  { value: "fullstack", label: "Développeur Full Stack" },
  { value: "mobile", label: "Développeur mobile" },
  { value: "software", label: "Développeur logiciel" },
  { value: "web", label: "Développeur web" },
  { value: "wordpress", label: "Développeur WordPress" },
  { value: "ecommerce", label: "Développeur e-commerce" },
  { value: "api", label: "Développeur API" },
  { value: "ai", label: "Développeur IA" },
  { value: "ml", label: "Ingénieur Machine Learning" },
  { value: "data-scientist", label: "Data Scientist" },
  { value: "data-analyst", label: "Data Analyst" },
  { value: "ui-ux", label: "UI/UX Designer" },
  { value: "product-design", label: "Product Designer" },
  { value: "game-dev", label: "Développeur de jeux vidéo" },
  { value: "devops", label: "Ingénieur DevOps" },
  { value: "cloud", label: "Ingénieur Cloud" },
  { value: "cybersecurity", label: "Expert cybersécurité" },
  { value: "dba", label: "Administrateur de bases de données" },
  { value: "architect", label: "Architecte logiciel" },
  { value: "blockchain", label: "Blockchain Developer" },
];

export const ALL_SPECIALTY_VALUES: string[] = SPECIALTIES.map((s) => s.value);
export const ALL_SPECIALTY_LABELS: Record<string, string> = Object.fromEntries(
  SPECIALTIES.map((s) => [s.value, s.label])
);
