import { z } from "zod";
import { PROJECT_TYPES, SENEGAL_REGIONS } from "@/lib/tokens";

export const briefSchema = z.object({
  client_name: z
    .string()
    .min(2, "Le nom est trop court.")
    .max(60, "Le nom est trop long."),
  client_whatsapp: z
    .string()
    .regex(
      /^\+?[0-9\s\-().]{9,20}$/,
      "Numéro WhatsApp invalide. Ex : +221771234567"
    ),
  client_city: z.enum(SENEGAL_REGIONS, {
    message: "Choisissez une région.",
  }),
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
      "Numéro WhatsApp invalide. Ex : +221771234567"
    ),
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
  city: z.enum(SENEGAL_REGIONS, {
    message: "Choisissez une région.",
  }),
  whatsapp: z
    .string()
    .regex(
      /^\+?[0-9\s\-().]{9,20}$/,
      "Numéro WhatsApp invalide. Ex : +221771234567"
    )
    .optional()
    .default(""),
});

export type ClientSignupFormValues = z.infer<typeof clientSignupSchema>;

export function parseSkills(raw: string): string[] {
  return raw
    .split(",")
    .map((skill) => skill.trim())
    .filter((skill) => skill.length > 0)
    .slice(0, 12);
}