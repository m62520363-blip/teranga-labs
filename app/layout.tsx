import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { Bodoni_Moda, DM_Sans, Geist_Mono, Outfit } from "next/font/google";
import { hasLocale } from "next-intl";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { SiteShell } from "@/components/site-shell";
import { Providers } from "@/components/providers";
import { getCurrentRole, getCurrentUser } from "@/lib/supabase/server";
import { absoluteUrl, buildAlternates } from "@/lib/utils";
import { routing } from "@/i18n/routing";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

/* Accent sérif italique du hero : rotation de phrases façon Montaaj. */
const bodoni = Bodoni_Moda({
  variable: "--font-bodoni",
  subsets: ["latin"],
  style: ["italic"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Métadonnées racine localisées (CP3).
 *
 * Elles servent de défaut à toutes les pages qui n'en définissent pas
 * (les pages sous [locale] qui ne surchargent rien, les 404, /admin…).
 * `getLocale()` lit l'en-tête `x-next-intl-locale` du middleware, avec le
 * fallback fr de i18n/request.ts — le layout racine fait déjà ce même
 * appel dans son corps, donc aucun coût dynamique supplémentaire.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("RootMeta");
  const hdrs = await headers();
  const pathname = hdrs.get("x-pathname") ?? "/";
  const rawLocale = await getLocale();
  const locale = hasLocale(routing.locales, rawLocale)
    ? rawLocale
    : routing.defaultLocale;
  return {
    metadataBase: absoluteUrl("/"),
    alternates: buildAlternates(pathname),
    title: {
      default: t("default"),
      template: "%s — TERANGA LABS",
    },
    description: t("description"),
    keywords: t.raw("keywords") as string[],
    manifest: "/manifest.json",
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/icon.png", sizes: "512x512", type: "image/png" },
      ],
      apple: "/apple-icon.png",
    },
    openGraph: {
      type: "website",
      locale,
      url: absoluteUrl(locale === "en" ? "/en" : "/"),
      title: t("ogTitle"),
      description: t("ogDescription"),
      siteName: "TERANGA LABS",
      images: [
        {
          url: absoluteUrl("/og.png"),
          width: 1200,
          height: 630,
          alt: t("ogAlt"),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t("ogTitle"),
      description: t("twitterDescription"),
      images: [absoluteUrl("/og.png")],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
};

/**
 * Données structurées pour les moteurs de recherche (localisées, CP3).
 *
 * Volontairement minimal : aucune note moyenne, aucun effectif et aucune
 * donnée d'immatriculation, qui seraient invérifiables. Les coordonnées
 * légales complètes restent à renseigner dans
 * app/[locale]/mentions-legales/page.tsx.
 *
 * Construites dans le composant : `locale` et `RootMeta` (descriptions,
 * noms de pays) suivent la locale de la requête, comme <html lang>.
 */
const COUNTRY_CODES = ["SN", "CI", "ML", "BF", "NE", "GN", "GW", "BJ", "TG"];

function buildJsonLd(locale: string, metaT: Awaited<ReturnType<typeof getTranslations>>) {
  const areaServed = (metaT.raw("countries") as string[]).map((name) => ({
    "@type": "Country",
    name,
  }));
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "TERANGA LABS",
    url: absoluteUrl("/").origin,
    logo: absoluteUrl("/icon.png"),
    description: metaT("orgDescription"),
    areaServed,
    knowsLanguage: locale,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      availableLanguage: [locale],
      areaServed: COUNTRY_CODES,
    },
  };
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "TERANGA LABS",
    url: absoluteUrl("/").origin,
    inLanguage: locale,
    publisher: { "@type": "Organization", name: "TERANGA LABS" },
    // Pas de SearchAction : la recherche des briefs est faite côté client
    // et n'est pas adressable par une URL (?q=), donc la déclarer ici
    // serait une promesse que le site ne tient pas.
  };
  return { organizationJsonLd, websiteJsonLd };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const [user, role] = await Promise.all([getCurrentUser(), getCurrentRole()]);

  // Locale fournie par le middleware next-intl (en-tête `x-next-intl-locale`).
  // `getLocale()` est garanti valide par le fallback de i18n/request.ts.
  const rawLocale = await getLocale();
  const locale = hasLocale(routing.locales, rawLocale)
    ? rawLocale
    : routing.defaultLocale;
  const messages = await getMessages();
  const metaT = await getTranslations("RootMeta");
  const { organizationJsonLd, websiteJsonLd } = buildJsonLd(locale, metaT);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${outfit.variable} ${bodoni.variable} ${dmSans.variable} ${geistMono.variable} bg-background font-sans text-foreground antialiased`}
      >
        <script
          type="application/ld+json"
          // Contenu statique défini ici, aucune donnée utilisateur ni saisie.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers isAuthed={Boolean(user)}>
            <SiteShell
              navbar={
                <Navbar
                  user={user ? { name: user.user_metadata?.full_name ?? null } : null}
                  role={role}
                  userId={user?.id ?? null}
                />
              }
              footer={<Footer />}
              role={role}
              user={
                user
                  ? {
                      name: user.user_metadata?.full_name ?? null,
                      email: user.email ?? null,
                    }
                  : null
              }
              userId={user?.id ?? null}
            >
              {children}
            </SiteShell>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}