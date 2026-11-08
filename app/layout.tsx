import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import localFont from "next/font/local";
import { hasLocale } from "next-intl";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import "./globals.css";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/react";
import { AuthStreamShell, AuthStreamShellFallback } from "@/components/auth-stream-shell";
import { PWARegister } from "@/components/pwa-register";

import { absoluteUrl, buildAlternates } from "@/lib/utils";
import { routing } from "@/i18n/routing";

/**
 * Fonts auto-hébergées (app/fonts/*.woff2, sous-ensemble latin variable).
 *
 * On est passé de next/font/google à next/font/local à cause du bug upstream
 * vercel/next.js#99114 : Google Fonts répond parfois (~1-2 %) des URLs sans
 * extension (`/l/font?kit=…`) que Turbopack ne sait pas parser → builds Vercel
 * en échec aléatoire. Les fichiers woff2 sont maintenant dans le repo : zéro
 * appel réseau au build, rendu identique (mêmes axes variable, même CSS var).
 */
const outfit = localFont({
  src: "./fonts/outfit-latin-var.woff2",
  variable: "--font-outfit",
  weight: "400 900",
  display: "swap",
});

/* Accent sérif italique du hero : rotation de phrases façon Montaaj. */
const bodoni = localFont({
  src: "./fonts/bodoni-moda-italic-latin-var.woff2",
  variable: "--font-bodoni",
  style: "italic",
  weight: "400 900",
  display: "swap",
});

const dmSans = localFont({
  src: "./fonts/dm-sans-latin-var.woff2",
  variable: "--font-dm-sans",
  weight: "400 700",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/geist-mono-latin-var.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
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
      template: "%s — Devmarket",
    },
    description: t("description"),
    keywords: t.raw("keywords") as string[],
    manifest: "/manifest.json",
    icons: {
      icon: [
        { url: "/icon.png", sizes: "any", type: "image/png" },
      ],
      apple: "/apple-icon.png",
    },
    openGraph: {
      type: "website",
      locale,
      url: absoluteUrl(locale === "en" ? "/en" : "/"),
      title: t("ogTitle"),
      description: t("ogDescription"),
      siteName: "Devmarket",
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
  themeColor: "#0B132B",
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
    name: "Devmarket",
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
    name: "Devmarket",
    url: absoluteUrl("/").origin,
    inLanguage: locale,
    publisher: { "@type": "Organization", name: "Devmarket" },
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["h1", "h2", ".lead", "main p"],
    },
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
        <link rel="ard" href={absoluteUrl("/.well-known/ard.json").toString()} />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Suspense fallback={<AuthStreamShellFallback>{children}</AuthStreamShellFallback>}>
            <AuthStreamShell>{children}</AuthStreamShell>
          </Suspense>
        </NextIntlClientProvider>
        <Analytics />
        <PWARegister />
      </body>
    </html>
  );
}