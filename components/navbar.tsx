"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  Briefcase,
  Coins,
  UsersRound,
  Home,
  Menu,
  MessageCircle,
  Plus,
  Settings2,
  UserRound,
  X,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { NotificationBell } from "@/components/notification-bell";
import { TokenBalance } from "@/components/token-balance";
import { SignOutButton } from "@/components/sign-out-button";
import { cn } from "cn";

type NavbarUser = {
  name: string | null;
};

type DockItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Met en avant l'action centrale (publication d'un brief). */
  emphasis?: boolean;
};

export function Navbar({
  user,
  role,
  userId,
}: {
  user: NavbarUser | null;
  role: string | null;
  userId: string | null;
}) {
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  const isClient = role === "client";
  const isDev = role === "developer";
  const authed = Boolean(user);
  const homeHref = authed ? (isClient ? "/client" : "/dashboard") : "/";

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const displayName =
    user?.name?.trim() || (authed ? (isClient ? "Mon espace" : "Mon compte") : null);

  const appLinks: { href: string; label: string; adminOnly?: boolean }[] = [];
  appLinks.push({ href: "/dev", label: "Trouver un développeur" });
  appLinks.push({ href: "/agences", label: "Agences" });
  if (authed) {
    appLinks.push({ href: homeHref, label: "Accueil" });
    appLinks.push({ href: "/conversations", label: "Messages" });
    appLinks.push({ href: "/missions", label: "Missions" });
    if (isClient) {
      appLinks.push({ href: "/poster", label: "Publier un brief" });
    } else if (isDev) {
      appLinks.push({ href: "/briefs", label: "Voir les briefs" });
      appLinks.push({ href: "/dashboard?tab=profil", label: "Mon profil" });
      appLinks.push({ href: "/verification", label: "Vérifier mon profil" });
    } else {
      appLinks.push({ href: "/briefs", label: "Voir les briefs" });
    }
    if (role === "admin") {
      appLinks.push({
        href: process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:3001",
        label: "Admin",
        adminOnly: true,
      });
    }
    appLinks.push({ href: "/tokens", label: "Acheter des Tokens" });
    appLinks.push({ href: "/parametres", label: "Paramètres" });
  }

  /** null = pas de dock (visiteurs non connectés : navigation via la navbar + menu). */
  const dockItems: DockItem[] | null = React.useMemo(() => {
    if (!authed) return null;
    if (isClient) {
      // Espace client : trouver un dev, publier, suivre ses missions.
      return [
        { href: "/client", label: "Accueil", icon: Home },
        { href: "/dev", label: "Dévs", icon: UsersRound },
        { href: "/poster", label: "Publier", icon: Plus, emphasis: true },
        { href: "/missions", label: "Missions", icon: Briefcase },
        { href: "/conversations", label: "Messages", icon: MessageCircle },
      ];
    }
    if (isDev) {
      // Espace développeur : décrocher des briefs, gagner des tokens, profil.
      // Pas d'action centrale « + » : le cœur du métier est la réponse aux briefs.
      return [
        { href: "/dashboard", label: "Accueil", icon: Home },
        { href: "/briefs", label: "Briefs", icon: Briefcase },
        { href: "/tokens", label: "Tokens", icon: Coins },
        { href: "/conversations", label: "Messages", icon: MessageCircle },
        { href: "/dashboard?tab=profil", label: "Profil", icon: UserRound },
      ];
    }
    // Autres rôles connectés (admin, …) : pas d'espace dédié sur le site.
    return [
      { href: "/briefs", label: "Briefs", icon: Briefcase },
      { href: "/dev", label: "Dévs", icon: UsersRound },
      { href: "/conversations", label: "Messages", icon: MessageCircle },
      { href: "/parametres", label: "Compte", icon: Settings2 },
    ];
  }, [isClient, isDev, authed]);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-300",
          scrolled || open
            ? "border-b border-white/10 bg-background/85 shadow-[0_10px_36px_-18px_rgba(0,0,0,0.8)] backdrop-blur-md"
            : "border-b border-transparent bg-transparent shadow-none"
        )}
      >
        <nav
          aria-label="Navigation principale"
          className="container-tl relative flex h-16 items-center justify-between gap-4"
        >
          <Link
            href={homeHref}
            className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-label="TERANGA LABS — accueil"
          >
            <Logo />
          </Link>

          {authed ? (
            <DesktopNavLinks pathname={pathname} authed appLinks={appLinks} />
          ) : (
            /* Nav visiteur façon Montaaj : liens centrés, pills arrondies. */
            <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 lg:flex">
              <Link
                href="/"
                className="text-sm font-medium text-foreground/80 transition-colors outline-none hover:text-foreground focus-visible:text-foreground"
              >
                Accueil
              </Link>
              <Link
                href="/#comment-ca-marche"
                className="text-sm font-medium text-foreground/80 transition-colors outline-none hover:text-foreground focus-visible:text-foreground"
              >
                Comment ça marche
              </Link>
              <Link
                href="/#tarifs"
                className="text-sm font-medium text-foreground/80 transition-colors outline-none hover:text-foreground focus-visible:text-foreground"
              >
                Tarifs
              </Link>
              <Link
                href="/#faq"
                className="text-sm font-medium text-foreground/80 transition-colors outline-none hover:text-foreground focus-visible:text-foreground"
              >
                FAQ
              </Link>
            </div>
          )}

          <div className="hidden items-center gap-2 lg:flex">
{user ? (
                <>
                  {userId ? <NotificationBell userId={userId} /> : null}
                  <TokenBalance />
                <NavLink href={homeHref} active={isActiveLink(pathname, homeHref)}>
                  {displayName ?? "Mon espace"}
                </NavLink>
                <SignOutButton />
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-medium text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  Se connecter
                </Link>
                <Link
                  href="/poster"
                  className="btn-shine inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground transition-[filter] outline-none hover:brightness-110 active:brightness-95 focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  Publier une demande
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex size-9 items-center justify-center rounded-control p-2 text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/50 lg:hidden"
            aria-expanded={open}
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </nav>

        {open && (
          <div className="border-t border-white/10 bg-surface/95 px-5 pb-6 pt-3 backdrop-blur-md lg:hidden">
            <div className="flex flex-col gap-1">
              {authed ? (
                <>
                  {appLinks.map((l) => (
                    <MobileNavLink key={l.href} href={l.href}>
                      {l.label}
                    </MobileNavLink>
                  ))}
                  <MobileNavLink href="/notifications">
                    Notifications
                  </MobileNavLink>
                  <div className="my-2 h-px bg-border-strong" />
                  <MobileNavLink href={homeHref}>
                    {displayName ?? "Mon espace"}
                  </MobileNavLink>
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-sm text-muted-foreground">Tokens</span>
                    <TokenBalance />
                  </div>
                  <SignOutButton variant="mobile" />
                </>
              ) : (
                <>
                  <MobileNavLink href="/">Accueil</MobileNavLink>
                  <MobileNavLink href="/#comment-ca-marche">
                    Comment ça marche
                  </MobileNavLink>
                  <MobileNavLink href="/#tarifs">Tarifs</MobileNavLink>
                  <MobileNavLink href="/#faq">FAQ</MobileNavLink>
                  <MobileNavLink href="/dev">Trouver un développeur</MobileNavLink>
                  <MobileNavLink href="/agences">Agences</MobileNavLink>
                  <MobileNavLink href="/poster">Pour les clients</MobileNavLink>
                  <MobileNavLink href="/briefs">Pour les développeurs</MobileNavLink>
                  <div className="my-2 h-px bg-border-strong" />
                  <MobileNavLink href="/login">Se connecter</MobileNavLink>
                  <Link
                    href="/poster"
                    className="btn-shine mt-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    Publier une demande
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {dockItems ? <MobileDock items={dockItems} pathname={pathname} /> : null}
    </>
  );
}

/* --------------------------- NAV DESKTOP ÉLECTRIQUE --------------------------- */

function DesktopNavLinks({
  pathname,
  authed,
  appLinks,
}: {
  pathname: string;
  authed: boolean;
  appLinks: { href: string; label: string; adminOnly?: boolean }[];
}) {
  const rowRef = React.useRef<HTMLDivElement>(null);
  const itemRefs = React.useRef(new Map<string, HTMLAnchorElement>());
  const [indicator, setIndicator] = React.useState<{
    x: number;
    w: number;
    visible: boolean;
  }>({ x: 0, w: 0, visible: false });

  React.useEffect(() => {
    const measure = () => {
      const row = rowRef.current;
      if (!row) return;
      const rowRect = row.getBoundingClientRect();
      let foundEl: HTMLAnchorElement | null = null;
      for (const el of itemRefs.current.values()) {
        const href = el.getAttribute("href") ?? "";
        if (isActiveLink(pathname, href.split("?")[0])) {
          foundEl = el;
          break;
        }
      }
      if (!foundEl) {
        setIndicator((p) => ({ ...p, visible: false }));
        return;
      }
      const rect = foundEl.getBoundingClientRect();
      setIndicator({
        x: rect.left - rowRect.left,
        w: rect.width,
        visible: true,
      });
    };
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [pathname, authed]);

  const links = authed
    ? appLinks
    : [
        { href: "/", label: "Accueil" },
        { href: "/dev", label: "Trouver un dev" },
        { href: "/agences", label: "Agences" },
        { href: "/#comment-ca-marche", label: "Comment ça marche" },
        { href: "/poster", label: "Pour les clients" },
        { href: "/briefs", label: "Pour les développeurs" },
        { href: "/faq", label: "FAQ" },
      ];

  return (
    <div ref={rowRef} className="relative hidden items-center gap-1 md:flex">
      <span
        aria-hidden="true"
        className={cn(
          "absolute bottom-0 h-[3px] rounded-full bg-gradient-to-r from-primary to-primary-light shadow-[0_0_12px_rgba(232,106,44,0.55)] transition-transform duration-500 will-change-transform [transition-timing-function:var(--ease-spring)]",
          !indicator.visible && "opacity-0"
        )}
        style={{
          width: indicator.w,
          height: indicator.visible ? 3 : 0,
          transform: `translateX(${indicator.x}px)`,
        }}
      />
      {links.map((l) => {
        const clean = l.href.split("?")[0];
        const active = !l.href.startsWith("#") && l.href !== "/#comment-ca-marche" && l.href !== "/#faq"
          ? isActiveLink(pathname, clean)
          : false;
        return (
          <Link
            key={l.href}
            ref={(el) => {
              if (el) itemRefs.current.set(l.href, el);
              else itemRefs.current.delete(l.href);
            }}
            href={l.href}
            className={cn(
              "inline-flex h-8 items-center rounded-lg px-3 font-display text-[15px] font-medium transition-colors duration-200 outline-none hover:bg-white/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50",
              active ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </div>
  );
}

/* ----------------------------- DOCK MOBILE FLOTTANT ---------------------------- */
/* Finition « vivante » façon Apple : verre flottant avec reflet qui traverse,
   capsule en dégradé primaire qui glisse au ressort sous l'onglet actif,
   icône active qui « pop », pression tactile qui resserre l'élément. */

function MobileDock({ items, pathname }: { items: DockItem[]; pathname: string }) {
  const rowRef = React.useRef<HTMLDivElement>(null);
  const itemRefs = React.useRef(new Map<string, HTMLAnchorElement>());
  const [pos, setPos] = React.useState<{ x: number; w: number; active: boolean }>({
    x: 0,
    w: 36,
    active: false,
  });

  const activeIndex = items.findIndex((it) => isActiveLink(pathname, it.href.split("?")[0]));
  const activeHref = activeIndex >= 0 ? items[activeIndex].href : null;

  React.useEffect(() => {
    const measure = () => {
      const row = rowRef.current;
      if (!row) return;
      const rowRect = row.getBoundingClientRect();
      const el = activeHref ? itemRefs.current.get(activeHref) : undefined;
      if (!el) {
        setPos((p) => ({ ...p, active: false }));
        return;
      }
      const rect = el.getBoundingClientRect();
      setPos({
        x: rect.left - rowRect.left + 3,
        w: rect.width - 6,
        active: true,
      });
    };
    const raf = requestAnimationFrame(measure);
    const t = window.setTimeout(measure, 120);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
      window.removeEventListener("resize", measure);
    };
  }, [pathname, activeHref, items]);

  return (
    <nav
      aria-label="Navigation rapide"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(0.6rem+env(safe-area-inset-bottom))] pt-2 md:hidden"
    >
      <div
        ref={rowRef}
        className="tl-dock-in relative w-full max-w-md overflow-hidden rounded-[1.6rem] border border-white/12 bg-surface/70 px-1.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_24px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl"
      >
        {/* Reflet vivant : un éclat traverse lentement le verre */}
        <span
          aria-hidden="true"
          className="tl-dock-sheen pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent"
        />
        {/* Capsule de l'onglet actif : glisse au ressort d'un onglet à l'autre */}
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute left-1.5 top-1.5 h-[calc(100%-0.75rem)] rounded-[1.2rem] bg-gradient-to-b from-primary to-primary-hover shadow-[0_6px_20px_-4px_rgba(232,106,44,0.55)] ring-1 ring-white/20 transition-all duration-500 will-change-transform [transition-timing-function:var(--ease-spring)]",
            !pos.active && "opacity-0"
          )}
          style={{
            width: pos.w,
            transform: `translateX(${pos.x}px)`,
          }}
        />
        <div className="relative flex items-stretch">
          {items.map((item) => {
            const active = isActiveLink(pathname, item.href.split("?")[0]);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                ref={(el) => {
                  if (el) itemRefs.current.set(item.href, el);
                  else itemRefs.current.delete(item.href);
                }}
                className="group relative flex w-full flex-1 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-[1.1rem] px-1 pb-1.5 pt-1.5 outline-none transition-transform duration-150 ease-out active:scale-90 focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <span
                  className={cn(
                    "grid place-items-center transition-all duration-300 [transition-timing-function:var(--ease-spring)] group-hover:scale-105",
                    active ? "scale-110" : "scale-100"
                  )}
                >
                  <Icon
                    className={cn(
                      "size-[19px] transition-colors duration-200",
                      active
                        ? "text-ink"
                        : item.emphasis
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-foreground"
                    )}
                    aria-hidden="true"
                  />
                </span>
                <span
                  className={cn(
                    "z-10 text-[10px] leading-tight tracking-tight transition-all duration-200",
                    active
                      ? "font-bold text-ink"
                      : item.emphasis
                        ? "font-semibold text-primary"
                        : "font-medium text-muted-foreground group-hover:text-foreground"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

/* --------------------------------- Helpers --------------------------------- */

function isActiveLink(pathname: string, href: string) {
  const clean = href.split("?")[0];
  if (clean === "/") return pathname === "/";
  if (clean === "/client") return pathname === "/client";
  if (clean === "/conversations") {
    return pathname === "/conversations" || pathname.startsWith("/conversations/");
  }
  if (clean === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === clean || pathname.startsWith(clean + "/");
}

function NavLink({
  href,
  children,
  active,
}: {
  href: string;
  children: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-8 items-center rounded-lg px-3 font-display text-[15px] font-medium transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50",
        active ? "text-foreground" : "text-muted-foreground"
      )}
    >
      {children}
    </Link>
  );
}

function MobileNavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg px-3 py-2 font-display text-[15px] font-medium text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      {children}
    </Link>
  );
}