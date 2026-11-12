import { z } from "zod";
import { PROJECT_TYPES } from "@/lib/tokens";
import { isKnownRegion } from "@/lib/countries";

/**
 * Champ « région » multi-pays : on stocke le NOM d'une région du référentiel
 * (`lib/countries.ts`, 9 pays). Le pays est dérivé côté app par `lib/geography.ts`.
 */
const regionField = (message = "Choisissez une région.") =>
  z
    .string()
    .trim()
    .refine((v) => isKnownRegion(v), { message });

/**
 * Ville/région d'inscription (client) et d'onboarding développeur :
 * le référentiel monde (~206 pays) propose des régions curées pour les
 * pays majeurs, mais un « champ libre » pour tous les autres — aucune
 * exception à l'inscription. On valide la longueur, pas l'appartenance
 * au périmètre (le brief, lui, garde `regionField` strict).
 */
const cityField = (message = "Indiquez votre ville ou région.") =>
  z
    .string()
    .trim()
    .min(2, message)
    .max(60, "60 caractères max.");

export const usernameSchema = z
  .string()
  .trim()
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    "Pseudo invalide : lettres minuscules, chiffres et tirets entre les mots (ex : moussa-diop)."
  )
  .min(3, "Au moins 3 caractères.")
  .max(48, "48 caractères max.");

export const developerIdentitySchema = z.object({
  first_name: z
    .string()
    .trim()
    .min(2, "Prénom trop court.")
    .max(60, "Prénom trop long."),
  last_name: z
    .string()
    .trim()
    .min(2, "Nom trop court.")
    .max(60, "Nom trop long."),
  username: usernameSchema,
  phone: z
    .string()
    .regex(
      /^\+?[0-9\s\-().]{9,20}$/,
      "Numéro invalide. Choisissez votre pays puis saisissez votre numéro."
    ),
  whatsapp: z
    .string()
    .regex(
      /^\+?[0-9\s\-().]{9,20}$/,
      "Numéro WhatsApp invalide. Choisissez votre pays puis saisissez votre numéro."
    ),
  address: z
    .string()
    .trim()
    .max(160, "Adresse trop longue.")
    .optional()
    .default(""),
  country: z
    .string()
    .trim()
    .min(2, "Pays requis.")
    .max(60, "Pays trop long."),
  city: z.string().trim().max(60, "60 caractères max.").optional().default(""),
  languages: z
    .array(z.string().trim().min(2, "Langue trop courte.").max(40, "40 caractères max."))
    .max(10, "10 langues maximum.")
    .default([]),
});

export type DeveloperIdentityFormValues = z.infer<
  typeof developerIdentitySchema
>;

export const developerProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nom du projet requis.")
    .max(100, "Nom trop long."),
  description: z
    .string()
    .trim()
    .max(1000, "Description trop longue (1000 caractères max).")
    .optional()
    .default(""),
  project_type: z
    .string()
    .trim()
    .max(60, "Type trop long.")
    .optional()
    .default(""),
  technologies: z
    .array(z.string().trim().min(1).max(40))
    .max(20, "20 technologies maximum.")
    .default([]),
  url: z
    .string()
    .trim()
    .url("URL invalide (https://…).")
    .max(500, "URL trop longue.")
    .optional()
    .or(z.literal(""))
    .default(""),
  screenshots: z
    .array(z.string().trim().url("URL invalide.").max(500))
    .max(10, "10 captures maximum.")
    .default([]),
  role: z
    .string()
    .trim()
    .max(200, "Rôle trop long (200 caractères max).")
    .optional()
    .default(""),
});

export type DeveloperProjectFormValues = z.infer<
  typeof developerProjectSchema
>;

export const developerDocumentSchema = z.object({
  kind: z.enum(["cv", "professional", "other"]).default("other"),
  name: z.string().trim().max(120, "Nom trop long.").optional().default(""),
  url: z
    .string()
    .trim()
    .url("URL invalide (https://…).")
    .max(500, "URL trop longue."),
});

export const developerLinkSchema = z.object({
  kind: z.enum(["github", "linkedin", "other"]).default("other"),
  label: z.string().trim().max(60, "Libellé trop long.").optional().default(""),
  url: z
    .string()
    .trim()
    .url("URL invalide (https://…).")
    .max(500, "URL trop longue."),
});

export const developerApplicationSchema = z
  .object({
    professional_title: z
      .string()
      .trim()
      .min(3, "Titre professionnel requis.")
      .max(120, "120 caractères max."),
    main_specialty: z
      .string()
      .trim()
      .min(3, "Spécialité requise.")
      .max(120, "120 caractères max."),
    experience_level: z.enum(
      ["debutant", "intermediaire", "avance", "expert"],
      { message: "Niveau d’expérience requis." }
    ),
    experience_years: z.coerce
      .number({ message: "Nombre invalide." })
      .int("Nombre entier.")
      .min(0, "Nombre invalide.")
      .max(100, "Nombre trop élevé."),
    projects_estimate: z.coerce
      .number({ message: "Nombre invalide." })
      .int("Nombre entier.")
      .min(0, "Nombre invalide."),
    availability: z.enum(
      ["available_now", "available_soon", "on_mission"],
      { message: "Disponibilité requise." }
    ),
    rate_min_fcfa: z.coerce
      .number({ message: "Montant invalide." })
      .int("Montant entier.")
      .min(0, "Montant invalide."),
    rate_max_fcfa: z.coerce
      .number({ message: "Montant invalide." })
      .int("Montant entier.")
      .min(0, "Montant invalide."),
    bio: z
      .string()
      .trim()
      .max(2000, "2000 caractères max.")
      .optional()
      .default(""),
    avatar_url: z
      .string()
      .trim()
      .max(500, "URL trop longue.")
      .optional()
      .default(""),
    services: z
      .array(z.string().trim().min(1))
      .min(1, "Sélectionnez au moins un service."),
    skills: z
      .array(z.string().trim().min(1))
      .min(1, "Ajoutez au moins une compétence.")
      .max(24, "24 compétences maximum."),
    projects: z.array(developerProjectSchema).default([]),
    documents: z.array(developerDocumentSchema).default([]),
    links: z.array(developerLinkSchema).default([]),
    terms_accepted: z.literal(true, {
      message:
        "Vous devez accepter les conditions d’utilisation et certifier l’exactitude des informations.",
    }),
  })
  .refine((d) => d.rate_max_fcfa >= d.rate_min_fcfa, {
    message: "Le tarif maximum doit être supérieur ou égal au minimum.",
    path: ["rate_max_fcfa"],
  });

export type DeveloperApplicationFormValues = z.infer<
  typeof developerApplicationSchema
>;

export const briefSchema = z.object({
  client_name: z
    .string()
    .min(2, "Le nom est trop court.")
    .max(60, "Le nom est trop long."),
  client_whatsapp: z
    .string()
    .regex(
      /^\+?[0-9\s\-().]{9,20}$/,
      "Numéro WhatsApp invalide. Choisissez votre pays puis saisissez votre numéro."
    ),
  client_city: z.string().trim().max(60, "60 caractères max.").optional().default(""),
  project_type: z.enum(PROJECT_TYPES, {
    message: "Choisissez un type de projet.",
  }),
  budget: z.coerce
    .number({ message: "Budget invalide." })
    .int("Le budget doit être un nombre entier.")
    .min(10000, "Le budget minimum est 10 000 FCFA.")
    .max(500000000, "Budget trop élevé."),
  description: z
    .string()
    .min(20, "Décrivez votre projet en au moins 20 caractères.")
    .max(2000, "Description trop longue (2000 caractères max)."),
  features: z
    .array(z.string().trim().min(1).max(80))
    .max(24, "Veuillez garder 24 fonctionnalités maximum.")
    .default([]),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date limite invalide.")
    .or(z.literal(""))
    .default(""),
});

export type BriefFormValues = z.infer<typeof briefSchema>;

export const loginSchema = z.object({
  email: z.string().email("Adresse email invalide."),
  password: z.string().min(1, "Le mot de passe est requis."),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  full_name: z
    .string()
    .min(2, "Votre nom est trop court.")
    .max(80, "Nom trop long."),
  email: z.string().email("Adresse email invalide."),
  password: z
    .string()
    .min(8, "Au moins 8 caractères.")
    .max(72, "Mot de passe trop long.")
    .regex(/[A-Za-z]/, "Au moins une lettre.")
    .regex(/\d/, "Au moins un chiffre."),
  whatsapp: z
    .string()
    .regex(
      /^\+?[0-9\s\-().]{9,20}$/,
      "Numéro WhatsApp invalide. Choisissez votre pays puis saisissez votre numéro."
    )
    .optional()
    .default(""),
  skills: z
    .string()
    .max(200, "200 caractères max.")
    .optional(),
});

export type SignupFormValues = z.infer<typeof signupSchema>;

export const clientSignupSchema = z.object({
  full_name: z
    .string()
    .min(2, "Votre nom est trop court.")
    .max(80, "Nom trop long."),
  company_name: z
    .string()
    .max(80, "Nom trop long.")
    .optional()
    .default(""),
  email: z.string().email("Adresse email invalide."),
  password: z
    .string()
    .min(8, "Au moins 8 caractères.")
    .max(72, "Mot de passe trop long.")
    .regex(/[A-Za-z]/, "Au moins une lettre.")
    .regex(/\d/, "Au moins un chiffre."),
  city: z.string().trim().max(60, "60 caractères max.").optional().default(""),
  whatsapp: z
    .string()
    .regex(
      /^\+?[0-9\s\-().]{9,20}$/,
      "Numéro WhatsApp invalide. Choisissez votre pays puis saisissez votre numéro."
    )
    .optional()
    .default(""),
});

export type ClientSignupFormValues = z.infer<typeof clientSignupSchema>;

/**
 * Numero de telephone pour la connexion par SMS.
 *
 * On exige le format international : Supabase a besoin d'un E.164 sans
 * espace pour envoyer le code, et un identifiant local ambigu est la
 * principale cause d'echec d'envoi. L'indicatif pays est saisi via le
 * sélecteur (PhoneInput) ou directement avec le « + ».
 */
export const phoneOtpSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(1, "Saisissez votre numéro de téléphone.")
    .transform((v) => v.replace(/[\s\-().]/g, ""))
    .refine(
      (v) => /^\+[1-9]\d{7,14}$/.test(v),
      "Numéro invalide. Choisissez votre pays puis saisissez votre numéro."
    ),
});

/** Corps de POST /api/payments/checkout (audit C5). */
export const paymentCheckoutSchema = z
  .object({
    packageId: z.string().trim().min(1, "packageId manquant.").max(64, "packageId invalide."),
  })
  .strict();

export type PaymentCheckoutBody = z.infer<typeof paymentCheckoutSchema>;

/** Paramètre GET /api/payments/status (audit C5). */
export const paymentStatusSchema = z.object({
  intent: z.string().uuid("Identifiant d'intention invalide."),
});

/** Corps de POST /api/verification/checkout (audit C5). */
export const verificationCheckoutSchema = z
  .object({
    method: z.enum(["chariow", "max_it"]).optional(),
  })
  .strict();

export type VerificationCheckoutBody = z.infer<typeof verificationCheckoutSchema>;

/** Corps de POST /api/otp/request (§9). */
export const otpRequestSchema = z
  .object({
    channel: z.enum(["whatsapp", "sms", "email"]),
    target: z
      .string()
      .trim()
      .min(9, "Cible invalide.")
      .max(80, "Cible invalide.")
      .optional(),
    purpose: z
      .enum(["verification", "phone_verify", "email_verify"])
      .default("verification"),
  })
  .strict();

export type OtpRequestBody = z.infer<typeof otpRequestSchema>;

/** Corps de POST /api/otp/verify (§9). */
export const otpVerifySchema = z
  .object({
    channel: z.enum(["whatsapp", "sms", "email"]),
    target: z
      .string()
      .trim()
      .min(9, "Cible invalide.")
      .max(80, "Cible invalide."),
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Code invalide : 6 chiffres attendus."),
    purpose: z
      .enum(["verification", "phone_verify", "email_verify"])
      .default("verification"),
  })
  .strict();

export type OtpVerifyBody = z.infer<typeof otpVerifySchema>;

/** Corps de POST /api/favorites/toggle (P1, §25). */
export const favoriteToggleSchema = z
  .object({
    request_id: z.string().uuid("Identifiant de projet invalide."),
  })
  .strict();

export type FavoriteToggleBody = z.infer<typeof favoriteToggleSchema>;

/** Corps de POST /api/newsletter (abonnement footer, B16). */
export const newsletterSubscribeSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, "L'adresse email est requise.")
      .email("Adresse email invalide.")
      .max(254, "Adresse email trop longue."),
    locale: z.enum(["fr", "en"]).default("fr"),
    source: z.string().trim().min(1).max(40).default("footer"),
  })
  .strict();

export type NewsletterSubscribeBody = z.infer<typeof newsletterSubscribeSchema>;

/**
 * Corps de POST /api/analytics/track (F3) : événements métier émisés par le
 * client. La liste est volontairement fermée — jamais d'arbitraire envoyé
 * à track_event.
 */
export const trackClientEventSchema = z
  .object({
    event: z.enum(["contact_unlocked", "profile_view", "contact_click"]),
    request_id: z.string().uuid("Identifiant invalide.").optional(),
    developer_id: z.string().uuid("Identifiant développeur invalide.").optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const needsDeveloper =
      value.event === "profile_view" || value.event === "contact_click";
    if (needsDeveloper && !value.developer_id) {
      ctx.addIssue({
        code: "custom",
        message: "Identifiant développeur manquant.",
        path: ["developer_id"],
      });
    }
  });

export type TrackClientEventBody = z.infer<typeof trackClientEventSchema>;

export function parseSkills(raw: string): string[] {
  return raw
    .split(",")
    .map((skill) => skill.trim())
    .filter((skill) => skill.length > 0)
    .slice(0, 12);
}