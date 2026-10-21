"use client";

import type { ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";
import { ClientShell } from "@/components/client/client-shell";
import { DashboardShell } from "@/components/nav/dashboard-shell";
import { isAppShellRoute } from "@/components/nav/app-nav";

/**
 * Chrome du site (navbar + padding principal + footer).
 *
 * Les routes d'authentification sont volontairement « nues » : page centrée
 * plein écran avec le seul logo cliquable, comme la référence Montaaj —
 * aucune barre de navigation ni de footer ne doit parasiter le formulaire.
 *
 * ESPACES SANS BANDEAU NOIR (décision projet) : un rôle client OU
 * développeur obtient SON shell sur toutes ses routes (plus de porte par
 * liste de routes) — la navbar publique fixe (`fixed … top-0`) et sa marge
 * `pt-16` ne s'appliquent donc jamais à ces espaces :
 * - client → ClientShell (sidebar V8 + tiroir mobile + dock d'action
 *   rapide) ; toutes les destinations (Agences, Publier un brief,
 *   wallet, paramètres, FR/EN, cloche, solde, déconnexion) restent
 *   accessibles depuis la sidebar et le tiroir.
 * - développeur → DashboardShell (sidebar sections + en-tête sticky +
 *   menu coulissant), déjà utilisé sur ses routes principales, étendu
 *   aux routes restantes (notifications, support, classement…).
 *
 * V8 dashboard : un utilisateur connecté d'un autre rôle (admin, …)
 * conserve le shell du dashboard sur les routes du menu — au lieu de la
 * navbar publique — et la navbar publique ailleurs, comme avant.
 *
 * Footer : UNIQUEMENT sur l'accueil, et seulement pour un visiteur non
 * connecté — jamais sur les pages intérieures ni dans les espaces
 * connectés.
 *
 * Thème : sombre unique partout (décision projet), sans bascule — il n'y
 * a donc plus d'attribut `data-app-theme` à synchroniser.
 */
const BARE_ROUTES = new Set(["/login", "/signup"]);

export function SiteShell({
  navbar,
  footer,
  children,
  role,
  user,
  userId,
}: {
  navbar: ReactNode;
  footer: ReactNode;
  children: ReactNode;
  role?: string | null;
  user?: { name: string | null; email: string | null } | null;
  userId?: string | null;
}) {
  const pathname = usePathname();

  if (BARE_ROUTES.has(pathname)) return <>{children}</>;

  /* Espace client : shell dédié partout, la navbar noire est supprimée. */
  if (role === "client") {
    return (
      <ClientShell user={user ?? null} userId={userId ?? null}>
        {children}
      </ClientShell>
    );
  }

  /* Espace développeur : shell sur toutes ses routes ; autres rôles
     connectés (admin…) : shell limité aux routes du menu, comme avant. */
  if (
    user &&
    role !== "client" &&
    (role === "developer" || isAppShellRoute(pathname))
  ) {
    return (
      <DashboardShell user={user ?? null} userId={userId ?? null} footer={footer}>
        {children}
      </DashboardShell>
    );
  }

  const showFooter = !user && pathname === "/";

  return (
    <div className="flex min-h-screen flex-col">
      {navbar}
      <main className="flex-1 pt-16 pb-28 md:pb-0">{children}</main>
      {showFooter ? footer : null}
    </div>
  );
}
