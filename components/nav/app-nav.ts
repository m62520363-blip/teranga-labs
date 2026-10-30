import type { ComponentType } from "react";
import {
  Activity,
  Banknote,
  Bell,
  Briefcase,
  Building2,
  ClipboardList,
  Coins,
  Contact,
  Crown,
  FileText,
  Heart,
  Home,
  LayoutGrid,
  Megaphone,
  MessageSquare,
  Plus,
  Send,
  Settings,
  ShieldCheck,
  Star,
  Trophy,
  UserRound,
  UsersRound,
  Wallet,
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
      { href: "/briefs", label: "Projets ouverts", labelKey: "openProjects", icon: FileText },
      { href: "/missions", label: "Missions", labelKey: "missions", icon: ClipboardList },
      { href: "/agences", label: "Agences", labelKey: "agencies", icon: Building2 },
    ],
  },
  {
    title: "MON PROFIL",
    titleKey: "profile",
    links: [
      {
        href: "/dashboard?tab=profil",
        search: "?tab=profil",
        label: "Mon profil & portfolio",
        labelKey: "myProfile",
        icon: UserRound,
      },
      { href: "/verification", label: "Mes vérifications", labelKey: "verifications", icon: ShieldCheck },
      { href: "/favoris", label: "Mes favoris", labelKey: "favorites", icon: Heart },
      { href: "/classement", label: "Mon classement", labelKey: "ranking", icon: Trophy },
    ],
  },
  {
    title: "VISIBILITÉ",
    titleKey: "visibility",
    links: [
      {
        href: "/dashboard?tab=crm",
        search: "?tab=crm",
        label: "Contacts débloqués",
        labelKey: "unlockedContacts",
        icon: Contact,
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
      { href: "/abonnement", label: "Abonnement PRO", labelKey: "proSubscription", icon: Crown },
    ],
  },
  {
    title: "PARAMÈTRES",
    titleKey: "settings",
    links: [
      { href: "/parametres", label: "Mon compte & mot de passe", labelKey: "accountSettings", icon: Settings },
      { href: "/notifications", label: "Notifications & alertes", labelKey: "notifications", icon: Bell },
      {
        href: "/dashboard?tab=agence",
        search: "?tab=agence",
        label: "Mon agence",
        labelKey: "myAgency",
        icon: Building2,
      },
    ],
  },
  {
    title: "FINANCES",
    titleKey: "finances",
    links: [
      { href: "/wallet", label: "Revenus & portefeuille", labelKey: "creditBalance", icon: Coins },
      { href: "/abonnement", label: "Mon abonnement", labelKey: "buyTokens", icon: Wallet },
      { href: "/wallet/retraits", label: "Demander un retrait", labelKey: "withdraw", icon: Banknote },
      {
        href: "/dashboard?tab=devis",
        search: "?tab=devis",
        label: "Mes devis envoyés",
        labelKey: "sentQuotes",
        icon: Send,
      },
      {
        href: "/dashboard?tab=missions",
        search: "?tab=missions",
        label: "Missions réalisées",
        labelKey: "completedMissions",
        icon: Briefcase,
      },
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
      { href: "/client/briefs", label: "Mes publications", icon: Megaphone },
      { href: "/favoris", label: "Mes favoris", icon: Heart },
    ],
  },
  {
    title: "COMMUNICATION",
    links: [{ href: "/conversations", label: "Messages", icon: MessageSquare }],
  },
  {
    title: "MON ESPACE",
    links: [
      { href: "/client/profil", label: "Mon profil", icon: UserRound },
      { href: "/wallet", label: "Mon wallet", icon: Coins },
      { href: "/parametres", label: "Paramètres", icon: Settings },
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
