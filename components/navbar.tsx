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
  LogIn,
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

type DockItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

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
  if (authed) {
    appLinks.push({ href: homeHref, label: "Accueil" });
    appLinks.push({ href: "/conversations", label: "Messages" });
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

  const dockItems: DockItem[] = React.useMemo(() => {
    if (isClient) {
      return [
        { href: "/client", label: "Accueil", icon: Home },
        { href: "/dev", label: "Dévs", icon: UsersRound },
        { href: "/tokens", label: "Tokens", icon: Coins },
        { href: "/conversations", label: "Messages", icon: MessageCircle },
        { href: "/poster", label: "Poster", icon: Plus },
        { href: "/parametres", label: "Compte", icon: Settings2 },
      ];
    }
    if (isDev) {
      return [
        { href: "/dashboard", label: "Accueil", icon: Home },
        { href: "/briefs", label: "Briefs", icon: Briefcase },
        { href: "/tokens", label: "Tokens", icon: Coins },
        { href: "/conversations", label: "Messages", icon: MessageCircle },
        { href: "/dashboard?tab=profil", label: "Profil", icon: UserRound },
        { href: "/parametres", label: "Compte", icon: Settings2 },
      ];
    }
    return [
      { href: "/", label: "Accueil", icon: Home },
      { href: "/briefs", label: "Briefs", icon: Briefcase },
      { href: "/faq", label: "FAQ", icon: MessageCircle },
      { href: "/poster", label: "Poster", icon: Plus },
      { href: "/login", label: "Connexion", icon: LogIn },
    ];
  }, [isClient, isDev]);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-40 transition-all duration-300",
          scrolled || open
            ? "border-b border-white/10 bg-[#0A0A0A]/85 shadow-[0_10px_36px_-18px_rgba(0,0,0,0.8)] backdrop-blur-md"
            : "border-b border-transparent bg-transparent"
        )}
      >
        <nav
          aria-label="Navigation principale"
          className="container-tl flex h-16 items-center justify-between"
        >
          <Link
            href={homeHref}
            className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-label="TERANGA LABS — accueil"
          >
            <Logo />
          </Link>

          <DesktopNavLinks
            pathname={pathname}
            authed={authed}
            appLinks={appLinks}
          />

          <div className="hidden items-center gap-2 md:flex">
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
                  className="inline-flex h-8 items-center rounded-lg px-3 font-display text-[15px] font-medium text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  Se connecter
                </Link>
                <Link
                  href="/poster"
                  className="group inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3.5 font-display text-[15px] font-semibold text-[#0D0D0D] transition-colors outline-none hover:bg-[#d95c1f] focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  Publier une demande
                  <ArrowRight
                    className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex size-9 items-center justify-center rounded-lg text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/50 md:hidden"
            aria-expanded={open}
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </nav>

        {open && (
          <div className="border-t border-white/10 bg-[#0B0B0B]/95 px-5 pb-6 pt-3 backdrop-blur-md md:hidden">
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
                  <div className="my-2 h-px bg-[#3A3A3A]" />
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
                  <MobileNavLink href="/dev">Trouver un développeur</MobileNavLink>
                  <MobileNavLink href="/#comment-ca-marche">Comment ça marche</MobileNavLink>
                  <MobileNavLink href="/poster">Pour les clients</MobileNavLink>
                  <MobileNavLink href="/briefs">Pour les développeurs</MobileNavLink>
                  <MobileNavLink href="/faq">FAQ</MobileNavLink>
                  <div className="my-2 h-px bg-[#3A3A3A]" />
                  <MobileNavLink href="/login">Se connecter</MobileNavLink>
                  <Link
                    href="/poster"
                    className="mt-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 font-display text-[15px] font-semibold text-[#0D0D0D] outline-none hover:bg-[#d95c1f] focus-visible:ring-2 focus-visible:ring-primary/50"
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

      {authed ? <MobileDock items={dockItems} pathname={pathname} /> : null}
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
          "absolute bottom-0 h-[3px] rounded-full bg-gradient-to-r from-primary to-[#F59348] shadow-[0_0_12px_rgba(232,106,44,0.55)] transition-transform duration-500 will-change-transform [transition-timing-function:var(--ease-spring)]",
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

function MobileDock({ items, pathname }: { items: DockItem[]; pathname: string }) {
  const rowRef = React.useRef<HTMLDivElement>(null);
  const halosRef = React.useRef(new Map<string, HTMLAnchorElement>());
  const [pos, setPos] = React.useState<{ x: number; y: number; w: number; active: boolean }>({
    x: 0,
    y: 0,
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
      const el = activeHref ? halosRef.current.get(activeHref.split("?")[0]) : undefined;
      if (!el) {
        setPos((p) => ({ ...p, active: false }));
        return;
      }
      const rect = el.getBoundingClientRect();
      setPos({
        x: rect.left - rowRect.left,
        y: rect.top - rowRect.top,
        w: rect.width,
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
      className="fixed inset-x-0 bottom-3 z-40 px-4 md:hidden"
    >
      <div
        ref={rowRef}
        className="relative mx-auto w-full max-w-md rounded-[1.75rem] border border-white/10 bg-[#0B0B0B]/85 px-2 py-2 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl"
      >
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute left-0 rounded-full bg-gradient-to-br from-primary to-[#d95c1f] shadow-[0_0_18px_rgba(232,106,44,0.5)] ring-1 ring-white/15 transition-transform duration-500 will-change-transform [transition-timing-function:var(--ease-spring)]",
            !pos.active && "opacity-0"
          )}
          style={{
            width: pos.w,
            height: pos.w,
            transform: `translate(${pos.x}px, ${pos.y}px)`,
            top: 0,
          }}
        />
        <div className="relative flex items-start">
          {items.map((item) => {
            const active = isActiveLink(pathname, item.href.split("?")[0]);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                ref={(el) => {
                  const key = item.href.split("?")[0];
                  if (el) halosRef.current.set(key, el);
                  else halosRef.current.delete(key);
                }}
                className="group flex w-full flex-1 flex-col items-center gap-1 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                style={{ touchAction: "manipulation" }}
              >
                <span
                  className={cn(
                    "grid size-9 place-items-center transition-transform duration-200 group-active:scale-90"
                  )}
                  style={{ minWidth: 36 }}
                >
                  <span
                    className={cn(
                      "relative z-10 grid size-9 place-items-center transition-colors duration-200",
                      active ? "text-[#0D0D0D]" : "text-muted-foreground group-hover:text-foreground"
                    )}
                  >
                    <Icon className="size-[18px]" aria-hidden="true" />
                  </span>
                </span>
                <span
                  className={cn(
                    "z-10 text-[10px] font-semibold tracking-tight transition-colors duration-200",
                    active ? "text-[#F59348]" : "text-muted-foreground"
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