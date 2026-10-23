import type { Metadata } from "next";
import {
  ArrowRight,
  FileText,
  HelpCircle,
  Home,
  Info,
  Mail,
  MapPin,
  Send,
  ShoppingBag,
  UserPlus,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Pages.sitemap");
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
  };
}

// Icônes et hrefs (langue-neutres) alignés sur l'ordre de Pages.sitemap.groups.
const GROUP_LINKS = [
  [
    { href: "/", icon: Home },
    { href: "/#comment-ca-marche", icon: HelpCircle },
    { href: "/poster", icon: ShoppingBag },
    { href: "/briefs", icon: UserPlus },
    { href: "/tokens", icon: ShoppingBag },
  ],
  [
    { href: "/a-propos", icon: Info },
    { href: "/faq", icon: HelpCircle },
    { href: "/contact", icon: Mail },
    { href: "/ville", icon: MapPin },
    { href: "/plan-du-site", icon: MapPin },
  ],
  [
    { href: "/mentions-legales", icon: FileText },
    { href: "/politique-de-confidentialite", icon: FileText },
    { href: "/conditions-utilisation", icon: FileText },
    { href: "/cookies", icon: FileText },
  ],
];

export default async function PlanDuSitePage() {
  const t = await getTranslations("Pages.sitemap");
  const groups = (
    t.raw("groups") as { title: string; links: { label: string }[] }[]
  ).map((group, groupIndex) => ({
    ...group,
    links: group.links.map((link, linkIndex) => ({
      ...link,
      href: GROUP_LINKS[groupIndex][linkIndex].href,
      icon: GROUP_LINKS[groupIndex][linkIndex].icon,
    })),
  }));

  return (
    <div className="bg-surface py-16 md:py-24">
      <div className="container-tl">
        <div className="mx-auto max-w-3xl">
          <span className="chip gap-2 bg-card/85 border-hairline backdrop-blur">
            <MapPin className="size-3.5 text-primary" aria-hidden="true" />
            Devmarket
          </span>
          <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {t("h1")}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
            {t("intro")}
          </p>

          <div className="mt-12 space-y-8">
            {groups.map((group) => (
              <section key={group.title} aria-labelledby={`plan-${group.title}`}>
                <h2
                  id={`plan-${group.title}`}
                  className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                >
                  {group.title}
                </h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {group.links.map((link) => (
                    <Link
                      key={link.label}
                      href={link.href}
                      className="group flex items-center justify-between gap-3 rounded-xl border border-hairline bg-card px-5 py-4 transition-colors outline-none hover:border-primary/40 hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/60"
                    >
                      <span className="flex items-center gap-3">
                        <link.icon
                          className="size-4 text-primary"
                          aria-hidden="true"
                        />
                        <span className="text-[15px] font-medium tracking-tight">
                          {link.label}
                        </span>
                      </span>
                      <ArrowRight
                        className="size-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <p className="mt-12 flex items-center gap-2 text-sm text-muted-foreground">
            <Send className="size-4 text-primary" aria-hidden="true" />
            {t("footer")}
          </p>
        </div>
      </div>
    </div>
  );
}
