import type { Metadata } from "next";
import Link from "next/link";
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

export const metadata: Metadata = {
  title: "Plan du site",
  description:
    "Retrouvez toutes les pages et sections de TERANGA LABS : navigation, pages découverte et documents légaux.",
};

const groups = [
  {
    title: "Navigation",
    links: [
      { label: "Accueil", href: "/", icon: Home },
      {
        label: "Comment ça marche",
        href: "/#comment-ca-marche",
        icon: HelpCircle,
      },
      { label: "Pour les clients", href: "/poster", icon: ShoppingBag },
      { label: "Pour les développeurs", href: "/briefs", icon: UserPlus },
      { label: "Acheter des Tokens", href: "/tokens", icon: ShoppingBag },
    ],
  },
  {
    title: "Découvrir",
    links: [
      { label: "À propos", href: "/a-propos", icon: Info },
      { label: "FAQ", href: "/faq", icon: HelpCircle },
      { label: "Contact", href: "/contact", icon: Mail },
      { label: "Plan du site", href: "/plan-du-site", icon: MapPin },
    ],
  },
  {
    title: "Légal",
    links: [
      { label: "Mentions légales", href: "/mentions-legales", icon: FileText },
      {
        label: "Politique de confidentialité",
        href: "/politique-de-confidentialite",
        icon: FileText,
      },
      {
        label: "Conditions d’utilisation",
        href: "/conditions-utilisation",
        icon: FileText,
      },
      { label: "Politique de cookies", href: "/cookies", icon: FileText },
    ],
  },
];

export default function PlanDuSitePage() {
  return (
    <div className="bg-surface py-16 md:py-24">
      <div className="container-tl">
        <div className="mx-auto max-w-3xl">
          <span className="chip gap-2 bg-[#141414]/85 border-hairline backdrop-blur">
            <MapPin className="size-3.5 text-primary" aria-hidden="true" />
            TERANGA LABS
          </span>
          <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Plan du site
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
            Tout est accessible en quelques clics : les pages principales, la
            découverte et les documents légaux.
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
                      className="group flex items-center justify-between gap-3 rounded-xl border border-hairline bg-[#141414] px-5 py-4 transition-colors outline-none hover:border-primary/40 hover:bg-[#1E1E1E] focus-visible:ring-2 focus-visible:ring-primary/60"
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
            Une question ? Écrivez-nous via la page Contact.
          </p>
        </div>
      </div>
    </div>
  );
}