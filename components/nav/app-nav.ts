import type { ComponentType } from "react";
import {
  BadgeCheck,
  Building2,
  ClipboardList,
  Coins,
  FileText,
  Home,
  MessageSquare,
  Settings,
  UserRound,
  UsersRound,
} from "lucide-react";

export type NavIcon = ComponentType<{ className?: string }>;

export type AppNavLink = {
  href: string;
  label: string;
  icon: NavIcon;
  /**
   * "exact"  → actif uniquement sur /dashboard (sans ?tab=profil)
   * "search" → actif uniquement sur /dashboard?tab=profil
   * (défaut) → préfixe : /x et /x/…
   */
  match?: "exact" | "search";
};

export type AppNavSection = {
  title: string;
  links: AppNavLink[];
};

/**
 * Menu unique de l'espace dashboard (ordinateur + mobile).
 * Sections identiques des deux côtés, comme demandé pour le V8.
 */
export const APP_NAV_SECTIONS: AppNavSection[] = [
  {
    title: "ESPACE PRINCIPAL",
    links: [
      { href: "/dashboard", label: "Accueil", icon: Home, match: "exact" },
      { href: "/dev", label: "Trouver un développeur", icon: UsersRound },
      { href: "/agences", label: "Agences", icon: Building2 },
      { href: "/missions", label: "Missions", icon: ClipboardList },
      { href: "/briefs", label: "Voir les briefs", icon: FileText },
    ],
  },
  {
    title: "COMMUNICATION",
    links: [{ href: "/conversations", label: "Messages", icon: MessageSquare }],
  },
  {
    title: "MON ESPACE",
    links: [
      {
        href: "/dashboard?tab=profil",
        label: "Mon profil",
        icon: UserRound,
        match: "search",
      },
      { href: "/verification", label: "Vérifier mon profil", icon: BadgeCheck },
      { href: "/tokens", label: "Acheter des Tokens", icon: Coins },
      { href: "/parametres", label: "Paramètres", icon: Settings },
    ],
  },
];

const SHELL_SEGMENTS = new Set([
  "dashboard",
  "dev",
  "agences",
  "missions",
  "briefs",
  "conversations",
  "verification",
  "tokens",
  "parametres",
]);

/** Routes sur lesquelles le shell du dashboard remplace la navbar publique. */
export function isAppShellRoute(pathname: string): boolean {
  const segment = pathname.split("/")[1] ?? "";
  return SHELL_SEGMENTS.has(segment);
}

/** État actif d'un lien du menu (profileTab = URL porte ?tab=profil). */
export function isAppNavLinkActive(
  pathname: string,
  link: AppNavLink,
  profileTab: boolean
): boolean {
  if (link.match === "search") return pathname === "/dashboard" && profileTab;
  if (link.match === "exact") return pathname === "/dashboard" && !profileTab;
  const clean = link.href.split("?")[0];
  return pathname === clean || pathname.startsWith(clean + "/");
}
