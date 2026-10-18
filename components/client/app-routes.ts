/**
 * Routes de l'espace client « applicatif » (chrome sidebar / bottom nav).
 *
 * La liste sert à deux choses :
 *  1. décider d'afficher le ClientShell (sidebar desktop + header/bottom-nav
 *     mobile) à la place de la navbar publique + footer ;
 *  2. activer le thème clair de l'espace app (l'attribut data-app-theme),
 *     uniquement sur ces routes — la landing et les pages publiques
 *     restent sur le thème sombre d'origine.
 */
export const CLIENT_APP_ROUTES = [
  "/client",
  "/dev",
  "/poster",
  "/missions",
  "/conversations",
  "/parametres",
  "/notifications",
  "/support",
  "/tokens",
] as const;

export function isClientAppRoute(pathname: string): boolean {
  return CLIENT_APP_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

export const THEME_STORAGE_KEY = "tl-app-theme";
export const SIDEBAR_STORAGE_KEY = "tl-sidebar";
