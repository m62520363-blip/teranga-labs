"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
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
import { LanguageSwitcher } from "@/components/language-switcher";
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
  const t = useTranslations("Nav");

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
    user?.name?.trim() || (authed ? (isClient ? t("mySpace") : t("myAccount")) : null);

  const appLinks: { href: string; label: string; adminOnly?: boolean }[] = [];
  // « Trouver un développeur » : réservé aux clients et aux visiteurs,
  // jamais à l'espace développeur.
  if (!isDev) {
    appLinks.push({ href: "/dev", label: t("findDev") });
  }
  appLinks.push({ href: "/agences", label: t("agencies") });
  if (authed) {
    appLinks.push({ href: homeHref, label: t("home") });
    appLinks.push({ href: "/conversations", label: t("messages") });
    appLinks.push({ href: "/missions", label: t("missions") });
    if (isClient) {
      appLinks.push({ href: "/poster", label: t("publishBrief") });
    } else if (isDev) {
      appLinks.push({ href: "/briefs", label: t("briefsView") });
      appLinks.push({ href: "/dashboard?tab=profil", label: t("myProfile") });
    } else {
      appLinks.push({ href: "/briefs", label: t("briefsView") });
    }
    if (role === "admin") {
      appLinks.push({
        href: process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:3001",
        label: t("admin"),
        adminOnly: true,
      });
    }
    appLinks.push({ href: "/wallet", label: t("buyTokens") });
    appLinks.push({ href: "/parametres", label: t("settings") });
  }

  /** null = pas de dock (visiteurs non connectés : navigation via la navbar + menu). */
  const dockItems: DockItem[] | null = React.useMemo(() => {
    if (!authed) return null;
    if (isClient) {
      // Espace client : trouver un dev, publier, suivre ses missions.
      return [
        { href: "/client", label: t("home"), icon: Home },
        { href: "/dev", label: t("devs"), icon: UsersRound },
        { href: "/poster", label: t("publish"), icon: Plus, emphasis: true },
        { href: "/missions", label: t("missions"), icon: Briefcase },
        { href: "/conversations", label: t("messages"), icon: MessageCircle },
      ];
    }
    if (isDev) {
      // Espace développeur : décrocher des briefs, gagner des tokens, profil.
      // Pas d'action centrale « + » : le cœur du métier est la réponse aux briefs.
      return [
        { href: "/dashboard", label: t("home"), icon: Home },
        { href: "/briefs", label: t("briefs"), icon: Briefcase },
        { href: "/wallet", label: t("tokens"), icon: Coins },
        { href: "/conversations", label: t("messages"), icon: MessageCircle },
        { href: "/dashboard?tab=profil", label: t("profile"), icon: UserRound },
      ];
    }
    // Autres rôles connectés (admin, …) : pas d'espace dédié sur le site.
    return [
      { href: "/briefs", label: t("briefs"), icon: Briefcase },
      { href: "/dev", label: t("devs"), icon: UsersRound },
      { href: "/conversations", label: t("messages"), icon: MessageCircle },
      { href: "/parametres", label: t("account"), icon: Settings2 },
    ];
  }, [isClient, isDev, authed, t]);

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
          aria-label={t("mainNav")}
          className="container-tl relative flex h-16 items-center justify-between gap-4"
        >
          <Link
            href={homeHref}
            className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-label={t("homeLink")}
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
                {t("home")}
              </Link>
              <Link
                href="/#comment-ca-marche"
                className="text-sm font-medium text-foreground/80 transition-colors outline-none hover:text-foreground focus-visible:text-foreground"
              >
                {t("howItWorks")}
              </Link>
              <Link
                href="/#tarifs"
                className="text-sm font-medium text-foreground/80 transition-colors outline-none hover:text-foreground focus-visible:text-foreground"
              >
                {t("pricing")}
              </Link>
              <Link
                href="/#faq"
                className="text-sm font-medium text-foreground/80 transition-colors outline-none hover:text-foreground focus-visible:text-foreground"
              >
                {t("faq")}
              </Link>
            </div>
          )}

          <div className="hidden items-center gap-2 lg:flex">
            <LanguageSwitcher />
{user ? (
                <>
                  {userId ? <NotificationBell userId={userId} /> : null}
                  <TokenBalance />
                <NavLink href={homeHref} active={isActiveLink(pathname, homeHref)}>
                  {displayName ?? t("mySpace")}
                </NavLink>
                <SignOutButton />
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-medium text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  {t("signIn")}
                </Link>
                <Link
                  href="/poster"
                  className="btn-shine inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground transition-[filter] outline-none hover:brightness-110 active:brightness-95 focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  {t("publishRequest")}
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex size-9 items-center justify-center rounded-control p-2 text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/50 lg:hidden"
            aria-expanded={open}
            aria-label={open ? t("closeMenu") : t("openMenu")}
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
                    {t("notifications")}
                  </MobileNavLink>
                  <div className="my-2 h-px bg-border-strong" />
                  <MobileNavLink href={homeHref}>
                    {displayName ?? t("mySpace")}
                  </MobileNavLink>
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-sm text-muted-foreground">{t("tokens")}</span>
                    <TokenBalance />
                  </div>
                  <div className="px-3 pb-1">
                    <LanguageSwitcher />
                  </div>
                  <SignOutButton variant="mobile" />
                </>
              ) : (
                <>
                  <MobileNavLink href="/">{t("home")}</MobileNavLink>
                  <MobileNavLink href="/#comment-ca-marche">
                    {t("howItWorks")}
                  </MobileNavLink>
                  <MobileNavLink href="/#tarifs">{t("pricing")}</MobileNavLink>
                  <MobileNavLink href="/#faq">{t("faq")}</MobileNavLink>
                  <MobileNavLink href="/dev">{t("findDev")}</MobileNavLink>
                  <MobileNavLink href="/agences">{t("agencies")}</MobileNavLink>
                  <MobileNavLink href="/poster">{t("forClients")}</MobileNavLink>
                  <MobileNavLink href="/briefs">{t("forDevs")}</MobileNavLink>
                  <div className="my-2 h-px bg-border-strong" />
                  <MobileNavLink href="/login">{t("signIn")}</MobileNavLink>
                  <Link
                    href="/poster"
                    className="btn-shine mt-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    {t("publishRequest")}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                  <div className="px-3 pb-1 pt-2">
                    <LanguageSwitcher />
                  </div>
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
  const t = useTranslations("Nav");
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
      // Clés brutes (sans préfixe de locale) : le href du DOM porte le
      // préfixe `/en` en anglais, incompatible avec `pathname` strippé.
      for (const href of itemRefs.current.keys()) {
        if (isActiveLink(pathname, href.split("?")[0])) {
          foundEl = itemRefs.current.get(href) ?? null;
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
        { href: "/", label: t("home") },
        { href: "/dev", label: t("findDevShort") },
        { href: "/agences", label: t("agencies") },
        { href: "/#comment-ca-marche", label: t("howItWorks") },
        { href: "/poster", label: t("forClients") },
        { href: "/briefs", label: t("forDevs") },
        { href: "/faq", label: t("faq") },
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
  const t = useTranslations("Nav");
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
      aria-label={t("quickNav")}
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

/* --------------------------- SWITCHER DE LANGUE --------------------------- */
/* Voir components/language-switcher.tsx (partagé avec les shells client et
   développeur : la navbar noire n'apparaît plus dans ces espaces). */

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