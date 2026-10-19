"use client";

import type { ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";
import { ClientShell } from "@/components/client/client-shell";
import { DashboardShell } from "@/components/nav/dashboard-shell";
import { isAppShellRoute } from "@/components/nav/app-nav";
import { isClientAppRoute } from "@/components/client/app-routes";

/**
 * Chrome du site (navbar + padding principal + footer).
 *
 * Les routes d'authentification sont volontairement « nues » : page centrée
 * plein écran avec le seul logo cliquable, comme la référence Montaaj —
 * aucune barre de navigation ni de footer ne doit parasiter le formulaire.
 *
 * Sur les routes de l'espace applicatif, un rôle client obtient le shell
 * dédié (sidebar V8 + tiroir mobile + dock d'action rapide) à la place de
 * la navbar publique.
 *
 * V8 dashboard : un utilisateur connecté non-client obtient le shell du
 * dashboard (barre latérale verticale sur ordinateur, en-tête sticky +
 * menu coulissant sur mobile) sur les routes du menu — au lieu de la
 * navbar publique.
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

  if (role === "client" && isClientAppRoute(pathname)) {
    return (
      <ClientShell user={user ?? null} userId={userId ?? null}>
        {children}
      </ClientShell>
    );
  }

  if (user && role !== "client" && isAppShellRoute(pathname)) {
    return (
      <DashboardShell user={user ?? null} userId={userId ?? null} footer={footer}>
        {children}
      </DashboardShell>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {navbar}
      <main className="flex-1 pt-16 pb-28 md:pb-0">{children}</main>
      {footer}
    </div>
  );
}
