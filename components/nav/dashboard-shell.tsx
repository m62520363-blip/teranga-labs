"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { NotificationBell } from "@/components/notification-bell";
import { TokenBalance } from "@/components/token-balance";
import { SignOutButton } from "@/components/sign-out-button";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  APP_NAV_SECTIONS,
  isAppNavLinkActive,
  type AppNavLink,
} from "@/components/nav/app-nav";
import { cn } from "cn";

type ShellUser = {
  name: string | null;
  email: string | null;
} | null;

function initialsOf(name: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0].charAt(0);
  const second = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + second).toUpperCase();
}

/**
 * Shell de l'espace dashboard (V8) — inspiré de la hiérarchie de navigation
 * de Montaaj, avec l'identité TERANGA LABS.
 *
 * Ordinateur (md+) : barre latérale verticale fixe à gauche, logo en haut,
 * liens groupés en sections, profil + solde réel + déconnexion en bas.
 * Mobile : en-tête sticky (bouton hamburger toujours visible au défilement)
 * et menu coulissant depuis la gauche, fond assombri, défilement autonome,
 * verrouillage du contenu derrière, fermeture à la navigation.
 */
export function DashboardShell({
  user,
  userId,
  footer,
  children,
}: {
  user: ShellUser;
  userId: string | null;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [profileTab, setProfileTab] = React.useState(false);
  /* Nom réel : métadonnées d'authentification, puis developers.full_name. */
  const [displayName, setDisplayName] = React.useState<string | null>(
    user?.name ?? null
  );

  /* Nom du profil développeur (meilleur effet que le nom de métadonnées). */
  React.useEffect(() => {
    if (!userId || displayName || !isSupabaseConfigured()) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await createClient()
          .from("developers")
          .select("full_name")
          .eq("id", userId)
          .maybeSingle();
        if (!cancelled && data?.full_name) setDisplayName(data.full_name);
      } catch {
        /* profil indisponible : on garde le nom d'authentification */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, displayName]);

  /* ?tab=profil : suivi de l'URL (init + retour arrière). */
  React.useEffect(() => {
    const sync = () =>
      setProfileTab(
        new URLSearchParams(window.location.search).get("tab") === "profil"
      );
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [pathname]);

  /* Le menu se ferme après toute navigation. */
  React.useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  /* Menu ouvert : le contenu derrière ne doit pas défiler. */
  React.useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    const mq =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(min-width: 768px)")
        : null;
    const onMq = () => {
      if (mq?.matches) setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    mq?.addEventListener("change", onMq);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
      mq?.removeEventListener("change", onMq);
    };
  }, [drawerOpen]);

  const handleLinkClick = React.useCallback((href: string) => {
    if (href === "/dashboard?tab=profil") setProfileTab(true);
    else if (href === "/dashboard") setProfileTab(false);
    setDrawerOpen(false);
  }, []);

  const sections = (
    <NavSections
      pathname={pathname}
      profileTab={profileTab}
      onLinkClick={handleLinkClick}
    />
  );

  const profileBlock = (
    <ProfileBlock
      user={user}
      name={displayName}
      onLinkClick={handleLinkClick}
    />
  );

  return (
    <div className="min-h-screen bg-background">
      {/* ---------------------------- SIDEBAR ORDINATEUR --------------------------- */}
      <aside
        aria-label="Navigation du dashboard"
        className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-surface md:flex"
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
          <Link
            href="/dashboard"
            aria-label="TERANGA LABS — accueil"
            className="flex min-w-0 items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <LogoMark className="size-7 shrink-0 text-foreground" aria-hidden="true" />
            <span className="truncate font-display text-sm font-bold tracking-tight text-foreground">
              TERANGA LABS
            </span>
          </Link>
          {userId ? <NotificationBell userId={userId} /> : null}
        </div>

        <nav
          aria-label="Menu du dashboard"
          className="min-h-0 flex-1 overflow-y-auto px-3 py-4"
        >
          {sections}
        </nav>

        <div className="shrink-0 border-t border-border p-3">{profileBlock}</div>
      </aside>

      {/* ------------------------------- CONTENU ------------------------------- */}
      <div className="md:pl-64">
        {/* En-tête mobile sticky : le hamburger reste visible en défilant. */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b border-border bg-background/90 px-3 backdrop-blur-md md:hidden">
          <Link
            href="/dashboard"
            aria-label="TERANGA LABS — accueil"
            className="flex min-w-0 items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <LogoMark className="size-7 shrink-0 text-foreground" aria-hidden="true" />
            <span className="truncate font-display text-[13px] font-bold tracking-tight text-foreground">
              TERANGA LABS
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-1.5">
            {userId ? <NotificationBell userId={userId} /> : null}
            <TokenBalance />
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-expanded={drawerOpen}
              aria-controls="app-nav-drawer"
              aria-label="Ouvrir le menu"
              className="inline-flex size-9 items-center justify-center rounded-control p-2 text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <main className="min-h-screen pb-16 md:pb-10">{children}</main>
        {footer ? <div>{footer}</div> : null}
      </div>

      {/* ------------------------------ MENU MOBILE ------------------------------ */}
      {drawerOpen ? (
        <div className="md:hidden">
          {/* Fond assombri : clic = fermer. */}
          <div
            aria-hidden="true"
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 z-[45] bg-black/60 animate-in fade-in-0"
          />
          <div
            id="app-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navigation"
            className="fixed inset-y-0 left-0 z-[46] flex w-72 max-w-[85vw] flex-col border-r border-border bg-surface shadow-2xl animate-in slide-in-from-left duration-200"
          >
            <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
              <Link
                href="/dashboard"
                onClick={() => setDrawerOpen(false)}
                aria-label="TERANGA LABS — accueil"
                className="flex min-w-0 items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <LogoMark
                  className="size-7 shrink-0 text-foreground"
                  aria-hidden="true"
                />
                <span className="truncate font-display text-[13px] font-bold tracking-tight text-foreground">
                  TERANGA LABS
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Fermer le menu"
                className="inline-flex size-9 items-center justify-center rounded-control p-2 text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <nav
              aria-label="Menu mobile du dashboard"
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4"
            >
              {sections}
            </nav>

            <div className="shrink-0 border-t border-border p-3">{profileBlock}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* --------------------------------- Sous-vues -------------------------------- */

function NavSections({
  pathname,
  profileTab,
  onLinkClick,
}: {
  pathname: string;
  profileTab: boolean;
  onLinkClick: (href: string) => void;
}) {
  return (
    <>
      {APP_NAV_SECTIONS.map((section) => (
        <div key={section.title} className="mb-5 last:mb-0">
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {section.title}
          </p>
          <ul className="flex flex-col gap-1">
            {section.links.map((link) => (
              <SideLink
                key={link.href}
                link={link}
                active={isAppNavLinkActive(pathname, link, profileTab)}
                onClick={() => onLinkClick(link.href)}
              />
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

function SideLink({
  link,
  active,
  onClick,
}: {
  link: AppNavLink;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = link.icon;
  return (
    <li>
      <Link
        href={link.href}
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group flex h-10 items-center gap-3 rounded-xl px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/50",
          active
            ? "bg-primary-soft font-semibold text-foreground"
            : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-lg transition-colors",
            active
              ? "bg-primary text-white"
              : "text-muted-foreground group-hover:text-foreground"
          )}
        >
          <Icon
            className={active ? "size-4" : "size-5"}
            aria-hidden="true"
          />
        </span>
        <span className="truncate">{link.label}</span>
        {active ? (
          <span
            aria-hidden="true"
            className="ml-auto size-1.5 shrink-0 rounded-full bg-primary"
          />
        ) : null}
      </Link>
    </li>
  );
}

function ProfileBlock({
  user,
  name,
  onLinkClick,
}: {
  user: ShellUser;
  name: string | null;
  onLinkClick: (href: string) => void;
}) {
  const displayName = name?.trim() || "Mon espace";
  return (
    <div className="flex flex-col gap-2">
      <Link
        href="/dashboard?tab=profil"
        onClick={() => onLinkClick("/dashboard?tab=profil")}
        className="flex items-center gap-2.5 rounded-xl p-2 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary-light">
          {initialsOf(name ?? user?.name ?? null)}
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm font-semibold text-foreground">
            {displayName}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {user?.email ?? "Mon compte"}
          </span>
        </span>
      </Link>
      {/* Solde réel (RPC get_token_balance via BalanceProvider). */}
      <TokenBalance />
      <SignOutButton variant="menu" />
    </div>
  );
}
