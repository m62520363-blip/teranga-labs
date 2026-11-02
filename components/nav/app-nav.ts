import type { ComponentType } from "react";
import {
  Activity,
  Building2,
  ClipboardList,
  Coins,
  Heart,
  Home,
  LayoutGrid,
  MessageSquare,
  Plus,
  Settings,
  Star,
  Trophy,
  UserRound,
  UsersRound,
} from "lucide-react";

export type NavIcon = ComponentType<{ className?: string }>;

export type AppNavLink = {
  href: string;
  label: string;
  /** Clé optionnelle dans AppNav.links pour la traduction FR/EN. */
  labelKey?: string;
  icon: NavIcon;
  /**
   * "exact" → actif uniquement sur /dashboard, sans aucun paramètre.
   * (sans cela, un lien « Accueil » resterait actif sur /dashboard?tab=avis)
   */
  match?: "exact";
  /**
   * Paramètre de requête attendu, par exemple "?tab=profil".
   * Permet à plusieurs entrées du menu de viser des onglets distincts du
   * tableau de bord tout en restant indépendamment surlignables.
   */
  search?: string;
};

export type AppNavSection = {
  title: string;
  /** Clé optionnelle dans AppNav.sections pour la traduction FR/EN. */
  titleKey?: string;
  links: AppNavLink[];
};

/**
 * Menu de l'espace développeur (ordinateur + mobile, mêmes sections).
 *
 * Hiérarchie organisée en « Mon compte » : Espace principal, puis les
 * quatre regroupements Mon profil / Visibilité / Paramètres / Finances.
 *
 * Toutes les destinations sont des routes RÉELLEMENT existantes — aucun
 * lien décoratif. Les entrées pointant sur des onglets du tableau de bord
 * portent `search: "?tab=…"`, dont la liste est déclarée dans
 * components/dashboard-content.tsx.
 */
export const APP_NAV_SECTIONS: AppNavSection[] = [
  {
    title: "ESPACE PRINCIPAL",
    titleKey: "main",
    links: [
      { href: "/dashboard", label: "Accueil", labelKey: "home", icon: Home, match: "exact" },
      { href: "/conversations", label: "Messages", labelKey: "messages", icon: MessageSquare },
      { href: "/agences", label: "Agences", labelKey: "agencies", icon: Building2 },
    ],
  },
  {
    title: "FINANCES",
    titleKey: "finances",
    links: [
      { href: "/wallet", label: "Revenus & portefeuille", labelKey: "creditBalance", icon: Coins },
    ],
  },
  {
    title: "VISIBILITÉ",
    titleKey: "visibility",
    links: [
      { href: "/classement", label: "Mon classement", labelKey: "ranking", icon: Trophy },
      { href: "/favoris", label: "Mes favoris", labelKey: "favorites", icon: Heart },
    ],
  },
  {
    title: "MON PROFIL",
    titleKey: "profile",
    links: [
      {
        href: "/dashboard?tab=profil",
        search: "?tab=profil",
        label: "Mon profil",
        labelKey: "myProfile",
        icon: UserRound,
      },
      {
        href: "/dashboard?tab=activite",
        search: "?tab=activite",
        label: "Réputation & commandes",
        labelKey: "reputation",
        icon: Activity,
      },
      {
        href: "/dashboard?tab=avis",
        search: "?tab=avis",
        label: "Mes avis",
        labelKey: "reviews",
        icon: Star,
      },
      { href: "/parametres", label: "Paramètres", labelKey: "accountSettings", icon: Settings },
    ],
  },
];

const SHELL_SEGMENTS = new Set([
  "dashboard",
  "dev",
  "agences",
  "missions",
  "briefs",
  "favoris",
  "conversations",
  "verification",
  "tokens",
  "wallet",
  "parametres",
  "notifications",
  "classement",
  "abonnement",
]);

/**
 * Menu de l'espace client (shell V8) : mêmes sections que le dashboard,
 * destinations propres au client (Tableau de bord, Catalogue, Mes projets,
 * Mes briefs, Mon profil).
 */
export const CLIENT_NAV_SECTIONS: AppNavSection[] = [
  {
    title: "ESPACE PRINCIPAL",
    links: [
      { href: "/client", label: "Tableau de bord", icon: LayoutGrid, match: "exact" },
      { href: "/poster", label: "Publier un projet", icon: Plus },
      { href: "/dev", label: "Catalogue", icon: UsersRound },
      { href: "/agences", label: "Agences", icon: Building2 },
      { href: "/missions", label: "Mes projets", icon: ClipboardList },
      { href: "/conversations", label: "Messages", icon: MessageSquare },
      { href: "/client/profil", label: "Mon profil", icon: UserRound },
    ],
  },
];

export const CLIENT_MOBILE_DRAWER_SECTIONS: AppNavSection[] = [
  {
    title: "MON ESPACE",
    links: [
      { href: "/client/profil", label: "Mon profil", icon: UserRound },
      { href: "/missions", label: "Mes projets", icon: ClipboardList },
      { href: "/agences", label: "Agences", icon: Building2 },
    ],
  },
];

/** État actif d'un lien du menu client. */
export function isClientNavLinkActive(
  pathname: string,
  link: AppNavLink
): boolean {
  if (link.match === "exact") return pathname === link.href;
  return pathname === link.href || pathname.startsWith(link.href + "/");
}

/** Routes sur lesquelles le shell du dashboard remplace la navbar publique. */
export function isAppShellRoute(pathname: string): boolean {
  const segment = pathname.split("/")[1] ?? "";
  return SHELL_SEGMENTS.has(segment);
}

/**
 * État actif d'un lien du menu.
 *
 * @param search  chaîne de requête courante, telle que "?tab=profil"
 *                (chaîne vide s'il n'y a pas de paramètre).
 */
export function isAppNavLinkActive(
  pathname: string,
  search: string,
  link: AppNavLink
): boolean {
  const clean = link.href.split("?")[0];
  if (link.match === "exact") {
    // « Accueil » ne doit pas rester surligné quand un onglet est ouvert.
    return pathname === "/dashboard" && !search;
  }
  if (link.search) {
    // Chaque entrée « ?tab=… » n'est active que pour SA valeur exacte :
    // sinon plusieurs onglets s'allumeraient en même temps.
    return pathname === clean && search === link.search;
  }
  return pathname === clean || pathname.startsWith(clean + "/");
}
