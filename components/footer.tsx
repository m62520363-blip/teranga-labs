import Image from "next/image";
import Link from "next/link";
import { BRAND, LEGAL_PUBLISHER } from "@/components/landing/content";

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
      { label: "Conditions d'utilisation", href: "/conditions-utilisation" },
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
            Le marketplace inversé de l&apos;Afrique de l&apos;Ouest francophone.{" "}
            <span className="text-white/90">Vous cherchez. Le marché répond.</span>
          </p>
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
        <div className="container-tl flex flex-col items-center gap-3 py-6 text-center text-sm text-white/60">
          <div className="flex flex-wrap items-center justify-center gap-2" aria-label="Pays d'Afrique de l'Ouest francophone">
            {[
              { code: "sn", name: "Sénégal" },
              { code: "bj", name: "Bénin" },
              { code: "bf", name: "Burkina Faso" },
              { code: "ci", name: "Côte d'Ivoire" },
              { code: "gw", name: "Guinée-Bissau" },
              { code: "ml", name: "Mali" },
              { code: "ne", name: "Niger" },
              { code: "tg", name: "Togo" },
            ].map((country) => (
              <Image
                key={country.code}
                src={`https://flagcdn.com/w40/${country.code}.png`}
                alt={country.name}
                width={30}
                height={20}
                className="h-5 w-auto rounded-sm shadow-sm"
              />
            ))}
          </div>
          <p className="text-sm text-white/60">Réservé aux pays d'Afrique de l'Ouest francophone (UEMOA)</p>
          <p>© {new Date().getFullYear()} {BRAND}. Tous droits réservés.</p>
          <p>{BRAND} est édité par {LEGAL_PUBLISHER}.</p>
        </div>
      </div>
    </footer>
  );
}