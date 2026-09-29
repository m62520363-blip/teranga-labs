import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@/components/landing/content";

const socials = [
  {
    label: "Facebook",
    href: "/",
    path: (
      <path d="M13.5 8.5V7c0-.8.3-1.3 1.4-1.3H16V3.2C15.5 3.1 14.6 3 13.7 3c-2.2 0-3.7 1.4-3.7 3.9v1.6H7v2.7h3V22h3.5v-10.8h2.8l.4-2.7h-3.2z" />
    ),
  },
  {
    label: "Instagram",
    href: "/",
    path: (
      <>
        <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" />
      </>
    ),
  },
  {
    label: "X (Twitter)",
    href: "/",
    path: (
      <path d="M17.9 3H21l-6.8 7.8L22.3 21h-6.3l-4.9-6.4L5.5 21H2.4l7.3-8.3L2 3h6.4l4.5 6L17.9 3zm-1.1 16.2h1.7L7.5 4.7H5.7l11.1 14.5z" />
    ),
  },
];

const columns = [
  {
    title: "Navigation",
    links: [
      { label: "Accueil", href: "/" },
      { label: "Comment ça marche", href: "/#comment-ca-marche" },
      { label: "Pour les clients", href: "/poster" },
      { label: "Pour les développeurs", href: "/briefs" },
      { label: "Acheter des Tokens", href: "/tokens" },
    ],
  },
  {
    title: "Découvrir",
    links: [
      { label: "À propos", href: "/a-propos" },
      { label: "FAQ", href: "/faq" },
      { label: "Contact", href: "/contact" },
      { label: "Plan du site", href: "/plan-du-site" },
    ],
  },
  {
    title: "Légal",
    links: [
      { label: "Mentions légales", href: "/mentions-legales" },
      { label: "Politique de confidentialité", href: "/politique-de-confidentialite" },
      { label: "Conditions d’utilisation", href: "/conditions-utilisation" },
      { label: "Politique de cookies", href: "/cookies" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-surface text-white border-t border-hairline">
      <div className="container-tl grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="max-w-xs">
          <span className="inline-flex">
            <span className="sr-only">{BRAND}</span>
            <Image
              src="/logo.png"
              alt=""
              width={2172}
              height={724}
              className="h-16 w-auto"
            />
          </span>
          <p className="mt-4 text-sm leading-relaxed text-white/60">
            Le marketplace inversé du Sénégal.{" "}
            <span className="text-white/90">« Vous cherchez. Le marché répond. »</span>
          </p>
          <ul className="mt-6 flex gap-2">
            {socials.map((social) => (
              <li key={social.label}>
                <a
                  href={social.href}
                  aria-label={social.label}
                  className="flex size-10 items-center justify-center rounded-xl border border-white/10 transition-colors outline-none hover:border-primary/60 hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="size-4"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    {social.path}
                  </svg>
                </a>
              </li>
            ))}
          </ul>
        </div>

        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h3 className="text-sm font-semibold text-white">{column.title}</h3>
            <ul className="mt-4 space-y-3">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/60 transition-colors outline-none hover:text-white focus-visible:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-white/10">
        <div className="container-tl flex flex-col items-start justify-between gap-2 py-6 text-sm text-white/50 sm:flex-row sm:items-center">
          <p>© {BRAND} — Tous droits réservés.</p>
          <p>Dakar, Sénégal</p>
        </div>
      </div>
    </footer>
  );
}