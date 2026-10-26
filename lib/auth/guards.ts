import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getCurrentRole, getCurrentUser } from "@/lib/supabase/server";

/**
 * Garde de route centralisée (§33, audit C3/C7).
 *
 * `requireUser` : garantit une session (Server Component).
 * `requireRole` : garantit une session ET un rôle dans la liste
 *   autorisée, sinon redirection vers /login (UI) — la vraie
 *   exécution des mutations reste protégée côté base par RLS/RPC.
 * `apiRequireRole` : même garde pour les routes API, avec réponse
 *   JSON 401/403 au lieu d'une redirection.
 */

export type AllowedRole =
  | "client"
  | "developer"
  | "agency"
  | "moderator"
  | "support"
  | "admin";

/** Tous les rôles qui peuvent utiliser une session : garde de connexion < -> rôles. */
export const CONNECTED_ROLES: AllowedRole[] = [
  "client",
  "developer",
  "agency",
  "moderator",
  "support",
  "admin",
];

const LOGIN_URL = "/login";

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_URL);
  return user;
}

/**
 * Garde de session pour les routes API : même comportement que la
 * construction « getCurrentUser() puis 401 » recopiée page par page,
 * centralisée ici (audit C7).
 */
export async function apiRequireUser() {
  const user = await getCurrentUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { code: "UNAUTHENTICATED", message: "Connectez-vous." },
        { status: 401 }
      ),
    };
  }
  return { user, response: null };
}

/**
 * Session facultative pour une route API publique : renvoie l'utilisateur
 * connecté ou `null`, sans jamais bloquer le visiteur anonyme.
 * Usage réservé aux routes de suivi/lecture qui acceptent les deux cas.
 */
export async function apiOptionalUser() {
  return getCurrentUser();
}

export async function requireRole(allowed: AllowedRole[]) {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_URL);

  const role = await getCurrentRole();
  if (!role || !allowed.includes(role as AllowedRole)) redirect(LOGIN_URL);
  return { user, role };
}

export async function apiRequireRole(allowed: AllowedRole[]) {
  const user = await getCurrentUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { code: "UNAUTHENTICATED", message: "Connectez-vous." },
        { status: 401 }
      ),
    };
  }

  const role = await getCurrentRole();
  if (!role || !allowed.includes(role as AllowedRole)) {
    return {
      user: null,
      response: NextResponse.json(
        { code: "FORBIDDEN", message: "Votre rôle ne permet pas cette action." },
        { status: 403 }
      ),
    };
  }

  return { user, response: null };
}