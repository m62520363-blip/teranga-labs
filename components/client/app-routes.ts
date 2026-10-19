/**
 * Routes de l'espace client « applicatif » (chrome sidebar / dock).
 *
 * La liste sert à décider d'afficher le ClientShell (sidebar V8 +
 * tiroir mobile + dock d'action rapide) à la place de la navbar
 * publique + footer.
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
