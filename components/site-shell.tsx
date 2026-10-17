"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Chrome du site (navbar + padding principal + footer).
 *
 * Les routes d'authentification sont volontairement « nues » : page centrée
 * plein écran avec le seul logo cliquable, comme la référence Montaaj —
 * aucune barre de navigation ni de footer ne doit parasiter le formulaire.
 */
const BARE_ROUTES = new Set(["/login", "/signup"]);

export function SiteShell({
  navbar,
  footer,
  children,
}: {
  navbar: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();

  if (BARE_ROUTES.has(pathname)) return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col">
      {navbar}
      <main className="flex-1 pt-16 pb-28 md:pb-0">{children}</main>
      {footer}
    </div>
  );
}
