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

const LOGIN_URL = "/login";

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_URL);
  return user;
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