"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "@/i18n/navigation";
import {
  ClipboardList,
  Headphones,
  LayoutGrid,
  Menu,
  MessageSquare,
  Plus,
  UsersRound,
  X,
} from "lucide-react";
import { ImageLogoMark } from "@/components/logo";
import { NotificationBell } from "@/components/notification-bell";
import { TokenBalance } from "@/components/token-balance";
import { SignOutButton } from "@/components/sign-out-button";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  CLIENT_NAV_SECTIONS,
  isClientNavLinkActive,
  type AppNavLink,
} from "@/components/nav/app-nav";
import { NavSections, ProfileBlock } from "@/components/nav/shell-parts";
import { cn } from "cn";

type ShellUser = {
  name: string | null;
  email: string | null;
} | null;

type DockItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};

/**
 * Dock mobile de l'espace client (4 destinations + action « Publier »),
 * conservé du design Montaaj — le hamburger ouvre le menu complet V8.
 */
const DOCK_ITEMS: DockItem[] = [
  { href: "/client", label: "Accueil", icon: LayoutGrid, exact: true },
  { href: "/missions", label: "Projets", icon: ClipboardList },
  { href: "/conversations", label: "Messages", icon: MessageSquare },
  { href: "/dev", label: "Catalogue", icon: UsersRound },
];

function isActive(pathname: string, item: { href: string; exact?: boolean }) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

/**
 * Shell de l'espace client (V8) — même squelette que le dashboard :
 * sidebar verticale à sections sur ordinateur, en-tête sticky + tiroir
 * coulissant sur mobile, plus le dock d'action rapide en bas (Montaaj).
 */
export function ClientShell({
  user,
  userId,
  children,
}: {
  user: ShellUser;
  userId: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = React.useState(false);

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

  const isLinkActive = React.useCallback(
    (link: AppNavLink) => isClientNavLinkActive(pathname, link),
    [pathname]
  );

  const handleLinkClick = React.useCallback(() => setDrawerOpen(false), []);

  const sections = (
    <NavSections
      sections={CLIENT_NAV_SECTIONS}
      isLinkActive={isLinkActive}
      onLinkClick={handleLinkClick}
    />
  );

  const profileBlock = (
    <ProfileBlock
      href="/client/profil"
      name={user?.name ?? null}
      email={user?.email ?? null}
      label="Mon espace"
      onLinkClick={handleLinkClick}
      extra={
        <>
          {/* Solde réel (les briefs coûtent des Tokens au client). */}
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
        aria-label="Navigation de l’espace client"
        className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-surface md:flex"
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
          <Link
            href="/client"
            aria-label="Devmarket — tableau de bord"
            className="flex min-w-0 items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <ImageLogoMark priority className="h-7 w-auto" alt="" />
          </Link>
          {userId ? <NotificationBell userId={userId} /> : null}
        </div>

        <nav
          aria-label="Menu de l’espace client"
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
            href="/client"
            aria-label="Devmarket — tableau de bord"
            className="flex min-w-0 items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <ImageLogoMark className="h-7 w-auto" alt="" />
          </Link>
          <div className="flex shrink-0 items-center gap-1.5">
            <Link
              href="/support"
              aria-label="Support"
              className="grid size-9 place-items-center rounded-full bg-primary text-ink outline-none transition-colors hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <Headphones className="size-[18px]" aria-hidden="true" />
            </Link>
            {userId ? <NotificationBell userId={userId} /> : null}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-expanded={drawerOpen}
              aria-controls="client-nav-drawer"
              aria-label="Ouvrir le menu"
              className="inline-flex size-9 items-center justify-center rounded-control p-2 text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="min-h-screen pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-12">
          {children}
        </main>
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
            id="client-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navigation"
            className="fixed inset-y-0 left-0 z-[46] flex w-72 max-w-[85vw] flex-col border-r border-border bg-surface shadow-2xl animate-in slide-in-from-left duration-200"
          >
            <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
              <Link
                href="/client"
                onClick={() => setDrawerOpen(false)}
                aria-label="Devmarket — tableau de bord"
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
              aria-label="Menu mobile de l’espace client"
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4"
            >
              {sections}
            </nav>

            <div className="shrink-0 border-t border-border p-3">{profileBlock}</div>
          </div>
        </div>
      ) : null}

      {/* -------------------- BOUTON SUPPORT (ordinateur) -------------------- */}
      <Link
        href="/support"
        aria-label="Support"
        className="fixed bottom-6 right-6 z-30 hidden size-12 place-items-center rounded-full bg-primary text-ink shadow-[0_16px_40px_-16px_rgba(57,255,136,0.7)] outline-none transition-colors hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary/50 md:grid"
      >
        <Headphones className="size-5" aria-hidden="true" />
      </Link>

      {/* --------------------- DOCK D'ACTION RAPIDE (mobile) -------------------- */}
      <nav
        aria-label="Navigation rapide"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid grid-cols-5 items-center px-1 pt-2">
          {DOCK_ITEMS.slice(0, 2).map((item) => (
            <DockLink key={item.href} item={item} pathname={pathname} />
          ))}
          <li className="flex justify-center">
            <Link
              href="/poster"
              aria-label="Publier un projet"
              className="grid size-11 place-items-center rounded-full bg-primary text-ink shadow-[0_10px_24px_-8px_rgba(57,255,136,0.65)] outline-none transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <Plus className="size-6" aria-hidden="true" />
            </Link>
          </li>
          {DOCK_ITEMS.slice(2).map((item) => (
            <DockLink key={item.href} item={item} pathname={pathname} />
          ))}
        </ul>
      </nav>
    </div>
  );
}

function DockLink({
  item,
  pathname,
}: {
  item: DockItem;
  pathname: string;
}) {
  const active = isActive(pathname, item);
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className="flex flex-col items-center gap-1 rounded-xl py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <Icon
          className={cn(
            "size-5",
            active ? "text-primary" : "text-muted-foreground"
          )}
          aria-hidden="true"
        />
        <span
          className={cn(
            "text-[10px] leading-tight",
            active
              ? "font-semibold text-primary"
              : "font-medium text-muted-foreground"
          )}
        >
          {item.label}
        </span>
      </Link>
    </li>
  );
}
