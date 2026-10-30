import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BRAND, LEGAL_PUBLISHER } from "@/components/landing/content";
import { ImageLogoMark } from "@/components/logo";
import { NewsletterForm } from "@/components/newsletter-form";
import { SocialLinks } from "@/components/social-links";

const columns = [
  {
    titleKey: "columns.platform",
    links: [
      { linkKey: "howItWorks", href: "/#comment-ca-marche" },
      { linkKey: "pricing", href: "/#tarifs" },
      { linkKey: "projects", href: "/briefs" },
      { linkKey: "developers", href: "/dev" },
    ],
  },
  {
    titleKey: "columns.clients",
    links: [
      { linkKey: "publishBrief", href: "/poster" },
      { linkKey: "findDev", href: "/dev" },
      { linkKey: "agencies", href: "/agences" },
      { linkKey: "faq", href: "/faq" },
    ],
  },
  {
    titleKey: "columns.developers",
    links: [
      { linkKey: "becomeDev", href: "/inscription-developpeur" },
      { linkKey: "browseProjects", href: "/briefs" },
      { linkKey: "devSpace", href: "/dashboard" },
      { linkKey: "buyTokens", href: "/tokens" },
      { linkKey: "proSubscription", href: "/abonnement" },
    ],
  },
  {
    titleKey: "columns.resources",
    links: [
      { linkKey: "ranking", href: "/classement" },
      { linkKey: "about", href: "/a-propos" },
      { linkKey: "contact", href: "/contact" },
      { linkKey: "sitemap", href: "/plan-du-site" },
    ],
  },
];

/**
 * Pied de page — la section M de la référence.
 * Quatre colonnes de liens réels, la marque, la newsletter et les mentions.
 * Aucun lien mort : chaque destination correspond à une route existante.
 */
export function Footer() {
  const t = useTranslations("Footer");
  return (
    <footer className="border-t border-hairline bg-surface">
      <div className="container-tl py-14 sm:py-16">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.1fr_2fr] lg:gap-16">
          <div>
            <Link
              href="/"
              className="inline-flex items-center outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              aria-label={BRAND}
            >
              <span className="sr-only">{BRAND}</span>
              <ImageLogoMark className="h-10 w-auto" alt="" />
            </Link>
            <p className="mt-4 max-w-xs font-headings text-base font-bold tracking-tight text-primary">
              {t("slogan")}
            </p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {t("description")}
            </p>

            <div className="mt-6 max-w-sm">
              <p className="font-headings text-sm font-semibold text-foreground">
                {t("newsletter.title")}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {t("newsletter.description")}
              </p>
              <NewsletterForm />
            </div>

            <SocialLinks />
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
            {columns.map((column) => (
              <nav
                key={column.titleKey}
                aria-label={t(column.titleKey)}
                className="min-w-0"
              >
                <h3 className="font-headings text-sm font-semibold tracking-tight text-foreground">
                  {t(column.titleKey)}
                </h3>
                <ul className="mt-5 flex flex-col gap-3.5 text-sm">
                  {column.links.map((link) => (
                    <li key={link.linkKey}>
                      <Link
                        href={link.href}
                        className="inline-block py-1 text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground focus-visible:underline focus-visible:underline-offset-4"
                      >
                        {t(`links.${link.linkKey}`)}
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
              © {new Date().getFullYear()} {BRAND}. {t("copyright")}
            </p>
            <ul className="mt-5 flex flex-wrap justify-start gap-x-5 gap-y-2 text-xs sm:mt-0 lg:justify-end">
              <li>
                <Link
                  href="/mentions-legales"
                  className="inline-block py-1 text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground focus-visible:underline focus-visible:underline-offset-4"
                >
                  {t("links.legal")}
                </Link>
              </li>
              <li>
                <Link
                  href="/politique-de-confidentialite"
                  className="inline-block py-1 text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground focus-visible:underline focus-visible:underline-offset-4"
                >
                  {t("links.privacy")}
                </Link>
              </li>
              <li>
                <Link
                  href="/conditions-utilisation"
                  className="inline-block py-1 text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground focus-visible:underline focus-visible:underline-offset-4"
                >
                  {t("links.terms")}
                </Link>
              </li>
            </ul>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            {t("publishedBy")} {LEGAL_PUBLISHER}. {t("location")}
          </p>
        </div>
      </div>
    </footer>
  );
}
