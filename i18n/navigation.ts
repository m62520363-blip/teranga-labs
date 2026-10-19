import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Wrappers des API de navigation de Next.js qui prennent en compte la
 * configuration de routage (préfixe `/en`, défaut FR sans préfixe).
 *
 * À préférer à `next/link` / `next/navigation` dans les composants du site
 * public pour conserver la locale courante d'un lien à l'autre.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
