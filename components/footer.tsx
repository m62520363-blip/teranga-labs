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
      { linkKey: "faq", href: "/#faq" },
      { linkKey: "briefs", href: "/briefs" },
    ],
  },
  {
    titleKey: "columns.account",
    links: [
      { linkKey: "publishBrief", href: "/poster" },
      { linkKey: "becomeDev", href: "/inscription-developpeur" },
      { linkKey: "login", href: "/login" },
    ],
  },
  {
    titleKey: "columns.help",
    links: [
      { linkKey: "faqFull", href: "/#faq" },
      { linkKey: "buyTokens", href: "/tokens" },
      { linkKey: "contact", href: "/contact" },
    ],
  },
];

export function Footer() {
  const t = useTranslations("Footer");
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
              <ImageLogoMark className="h-10 w-auto" alt="" />
            </Link>
            <p className="mt-4 max-w-xs font-headings text-base font-bold tracking-tight text-primary">
              {t("slogan")}
            </p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {t("tagline")}
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

          <div className="mt-12 grid grid-cols-2 gap-8 lg:mt-0 lg:flex-1 lg:grid-cols-3 lg:gap-y-16">
            {columns.map((column) => (
              <nav key={column.titleKey} aria-label={t(column.titleKey)}>
                <h3 className="font-headings text-sm font-semibold text-foreground">
                  {t(column.titleKey)}
                </h3>
                <ul className="mt-6 flex flex-col gap-4 text-sm">
                  {column.links.map((link) => (
                    <li key={link.linkKey}>
                      <Link
                        href={link.href}
                        className="text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground"
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
            <ul className="mt-6 flex flex-wrap justify-start gap-4 text-xs sm:mt-0 lg:justify-end">
              <li>
                <Link
                  href="/mentions-legales"
                  className="text-muted-foreground transition-colors outline-none hover:text-foreground"
                >
                  {t("links.legal")}
                </Link>
              </li>
              <li>
                <Link
                  href="/politique-de-confidentialite"
                  className="text-muted-foreground transition-colors outline-none hover:text-foreground"
                >
                  {t("links.privacy")}
                </Link>
              </li>
              <li>
                <Link
                  href="/conditions-utilisation"
                  className="text-muted-foreground transition-colors outline-none hover:text-foreground"
                >
                  {t("links.terms")}
                </Link>
              </li>
            </ul>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            {t("publishedBy")} {LEGAL_PUBLISHER}.
          </p>
        </div>
      </div>
    </footer>
  );
}
