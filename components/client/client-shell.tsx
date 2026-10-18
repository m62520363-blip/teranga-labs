"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  Headphones,
  LayoutGrid,
  Megaphone,
  MessageSquare,
  Moon,
  PanelLeft,
  Plus,
  Settings,
  Sun,
  UserRound,
  UsersRound,
} from "lucide-react";
import { LogoMark } from "@/components/logo";
import { NotificationBell } from "@/components/notification-bell";
import { SignOutButton } from "@/components/sign-out-button";
import { SIDEBAR_STORAGE_KEY } from "@/components/client/app-routes";
import { cn } from "cn";

type ShellUser = {
  name: string | null;
  email: string | null;
} | null;

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/client", label: "Tableau de bord", icon: LayoutGrid, exact: true },
  { href: "/dev", label: "Catalogue", icon: UsersRound },
  { href: "/conversations", label: "Messages", icon: MessageSquare },
  { href: "/missions", label: "Mes projets", icon: ClipboardList },
  { href: "/client/briefs", label: "Mes briefs", icon: Megaphone },
  { href: "/client/profil", label: "Mon profil", icon: UserRound },
];

type DockItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};

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

function initialsOf(name: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0].charAt(0);
  const second = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + second).toUpperCase();
}

export function ClientShell({
  user,
  userId,
  theme,
  onToggleTheme,
  children,
}: {
  user: ShellUser;
  userId: string | null;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    try {
      if (window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1") {
        setExpanded(true);
      }
    } catch {
      /* stockage indisponible : sidebar réduite */
    }
  }, []);

  const toggleSidebar = () => {
    setExpanded((v) => {
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, v ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !v;
    });
  };

  const displayName = user?.name?.trim() || "Mon espace";

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-surface transition-[width] duration-300 md:flex",
          expanded ? "w-52" : "w-16"
        )}
      >
        <div className="flex h-16 items-center justify-between gap-1 px-2">
          <Link
            href="/client"
            aria-label="TERANGA LABS — tableau de bord"
            className="flex min-w-0 items-center gap-2 rounded-lg px-1 outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <LogoMark className="size-7 shrink-0 text-foreground" />
            {expanded ? (
              <span className="truncate font-display text-[13px] font-bold tracking-tight text-foreground">
                TERANGA LABS
              </span>
            ) : null}
          </Link>
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={expanded ? "Réduire le menu" : "Ouvrir le menu"}
            aria-expanded={expanded}
            className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <PanelLeft className="size-4" aria-hidden="true" />
          </button>
        </div>

        <nav
          aria-label="Navigation de l’espace client"
          className="min-h-0 flex-1 overflow-y-auto px-2 py-1"
        >
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    title={expanded ? undefined : item.label}
                    className={cn(
                      "group flex h-10 items-center gap-3 rounded-xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/50",
                      expanded ? "px-2.5" : "justify-center px-0",
                      active ? "bg-primary-soft" : "hover:bg-muted"
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
                    {expanded ? (
                      <span
                        className={cn(
                          "truncate text-sm",
                          active
                            ? "font-semibold text-foreground"
                            : "font-medium text-muted-foreground group-hover:text-foreground"
                        )}
                      >
                        {item.label}
                      </span>
                    ) : (
                      <span className="sr-only">{item.label}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-border p-2">
          <AccountMenu
            user={user}
            theme={theme}
            onToggleTheme={onToggleTheme}
            align="sidebar"
          >
            <span
              className="flex w-full items-center gap-2.5 rounded-xl p-2 outline-none transition-colors hover:bg-muted"
              title={expanded ? undefined : displayName}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-[11px] font-bold text-primary-light">
                {initialsOf(user?.name ?? null)}
              </span>
              {expanded ? (
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-xs font-semibold text-foreground">
                    {displayName}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {user?.email ?? "Mon compte"}
                  </span>
                </span>
              ) : null}
            </span>
          </AccountMenu>
        </div>
      </aside>

      <div
        className={cn(
          "transition-[padding] duration-300",
          expanded ? "md:pl-52" : "md:pl-16"
        )}
      >
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface/90 px-4 backdrop-blur-md md:hidden">
          <Link
            href="/client"
            aria-label="TERANGA LABS — tableau de bord"
            className="flex items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <LogoMark className="size-7 text-foreground" aria-hidden="true" />
            <span className="font-display text-[13px] font-bold tracking-tight text-foreground">
              TERANGA LABS
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/support"
              aria-label="Support"
              className="grid size-9 place-items-center rounded-full bg-primary text-white outline-none transition-colors hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <Headphones className="size-[18px]" aria-hidden="true" />
            </Link>
            {userId ? (
              <span className="grid size-9 place-items-center rounded-full border border-border">
                <NotificationBell userId={userId} />
              </span>
            ) : null}
            <AccountMenu
              user={user}
              theme={theme}
              onToggleTheme={onToggleTheme}
              align="header"
            >
              <span className="grid size-9 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary-light outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-primary/50">
                {initialsOf(user?.name ?? null)}
              </span>
            </AccountMenu>
          </div>
        </header>

        <main className="min-h-screen pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-12">
          {children}
        </main>
      </div>

      <Link
        href="/support"
        aria-label="Support"
        className="fixed bottom-6 right-6 z-30 hidden size-12 place-items-center rounded-full bg-primary text-white shadow-[0_16px_40px_-16px_rgba(232,106,44,0.7)] outline-none transition-colors hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary/50 md:grid"
      >
        <Headphones className="size-5" aria-hidden="true" />
      </Link>

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
              aria-label="Publier un brief"
              className="grid size-11 place-items-center rounded-full bg-primary text-white shadow-[0_10px_24px_-8px_rgba(232,106,44,0.65)] outline-none transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/50"
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

function AccountMenu({
  user,
  theme,
  onToggleTheme,
  align,
  children,
}: {
  user: ShellUser;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  align: "sidebar" | "header";
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Menu du compte"
        className="block w-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1"
      >
        {children}
      </button>

      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute z-50 w-60 rounded-2xl border border-border bg-popover p-1.5 shadow-2xl shadow-black/25",
            align === "sidebar"
              ? "bottom-full left-0 mb-2"
              : "right-0 top-11"
          )}
        >
          <div className="border-b border-border px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-popover-foreground">
              {user?.name?.trim() || "Mon espace"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user?.email ?? "Compte TERANGA LABS"}
            </p>
          </div>
          <div className="py-1">
            <MenuLink href="/client/profil" onClick={() => setOpen(false)}>
              <UserRound className="size-4" aria-hidden="true" />
              Mon profil
            </MenuLink>
            <MenuLink href="/parametres" onClick={() => setOpen(false)}>
              <Settings className="size-4" aria-hidden="true" />
              Paramètres
            </MenuLink>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onToggleTheme();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-popover-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              {theme === "light" ? (
                <Moon className="size-4" aria-hidden="true" />
              ) : (
                <Sun className="size-4" aria-hidden="true" />
              )}
              {theme === "light" ? "Thème sombre" : "Thème clair"}
            </button>
          </div>
          <div className="border-t border-border py-1">
            <SignOutButton variant="menu" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MenuLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-popover-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      {children}
    </Link>
  );
}
