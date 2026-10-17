import Link from "next/link";
import { BRAND, LEGAL_PUBLISHER } from "@/components/landing/content";

const columns = [
  {
    title: "Plateforme",
    links: [
      { label: "Comment ça marche", href: "/#comment-ca-marche" },
      { label: "Tarifs", href: "/#tarifs" },
      { label: "FAQ", href: "/#faq" },
      { label: "Briefs", href: "/briefs" },
    ],
  },
  {
    title: "Compte",
    links: [
      { label: "Publier un brief", href: "/poster" },
      { label: "Devenir développeur", href: "/inscription-developpeur" },
      { label: "Connexion", href: "/login" },
    ],
  },
  {
    title: "Aide",
    links: [
      { label: "Questions fréquentes", href: "/#faq" },
      { label: "Acheter des Tokens", href: "/tokens" },
      { label: "Nous contacter", href: "/contact" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-hairline bg-surface">
      <div className="container-tl py-16">
        <div className="lg:flex lg:items-start lg:gap-12">
          <div className="shrink-0">
            <Link
              href="/"
              className="inline-flex items-center outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              aria-label={BRAND}
            >
              <span className="sr-only">{BRAND}</span>
              {/* eslint-disable-next-line @next/next/no-img-element -- logo simple, pas de next/image pour un PNG statique */}
              <img src="/logo.png" alt="" className="h-10 w-auto" />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Le marketplace des projets web de l&apos;Afrique de l&apos;Ouest
              francophone. Tu paies en Tokens, ton argent ne bouge jamais en
              commission.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-8 lg:mt-0 lg:flex-1 lg:grid-cols-3 lg:gap-y-16">
            {columns.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <h3 className="font-headings text-sm font-semibold text-foreground">
                  {column.title}
                </h3>
                <ul className="mt-6 flex flex-col gap-4 text-sm">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-12 border-t border-hairline pt-8">
          <div className="sm:flex sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} {BRAND}. Dakar, Sénégal.
            </p>
            <ul className="mt-6 flex flex-wrap justify-start gap-4 text-xs sm:mt-0 lg:justify-end">
              <li>
                <Link
                  href="/mentions-legales"
                  className="text-muted-foreground transition-colors outline-none hover:text-foreground"
                >
                  Mentions légales
                </Link>
              </li>
              <li>
                <Link
                  href="/politique-de-confidentialite"
                  className="text-muted-foreground transition-colors outline-none hover:text-foreground"
                >
                  Confidentialité
                </Link>
              </li>
              <li>
                <Link
                  href="/conditions-utilisation"
                  className="text-muted-foreground transition-colors outline-none hover:text-foreground"
                >
                  Conditions
                </Link>
              </li>
            </ul>
          </div>
          <p className="mt-4 text-xs text-muted-foreground/70">
            Édité par {LEGAL_PUBLISHER}.
          </p>
        </div>
      </div>
    </footer>
  );
}
