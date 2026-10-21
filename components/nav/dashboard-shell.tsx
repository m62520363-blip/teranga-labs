"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "@/i18n/navigation";
import { Menu, X } from "lucide-react";
import { ImageLogoMark } from "@/components/logo";
import { NotificationBell } from "@/components/notification-bell";
import { TokenBalance } from "@/components/token-balance";
import { SignOutButton } from "@/components/sign-out-button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  APP_NAV_SECTIONS,
  isAppNavLinkActive,
  type AppNavLink,
} from "@/components/nav/app-nav";
import {
  NavSections,
  ProfileBlock,
} from "@/components/nav/shell-parts";

type ShellUser = {
  name: string | null;
  email: string | null;
} | null;

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

  const isLinkActive = React.useCallback(
    (link: AppNavLink) => isAppNavLinkActive(pathname, link, profileTab),
    [pathname, profileTab]
  );

  const sections = (
    <NavSections
      sections={APP_NAV_SECTIONS}
      isLinkActive={isLinkActive}
      onLinkClick={handleLinkClick}
    />
  );

  const profileBlock = (
    <ProfileBlock
      href="/dashboard?tab=profil"
      name={displayName ?? user?.name ?? null}
      email={user?.email ?? null}
      onLinkClick={() => handleLinkClick("/dashboard?tab=profil")}
      extra={
        <>
          {/* Solde réel (RPC get_token_balance via BalanceProvider). */}
          <TokenBalance />
          {/* Bascule FR/EN déplacée de la navbar noire supprimée. */}
          <LanguageSwitcher />
          <SignOutButton variant="menu" />
        </>
      }
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
            <ImageLogoMark priority className="h-7 w-auto" alt="" />
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
            <ImageLogoMark className="h-7 w-auto" alt="" />
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
                <ImageLogoMark className="h-7 w-auto" alt="" />
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
