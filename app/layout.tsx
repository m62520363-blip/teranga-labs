import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { DM_Sans, Geist_Mono, Outfit } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Providers } from "@/components/providers";
import { getCurrentRole, getCurrentUser } from "@/lib/supabase/server";
import { absoluteUrl } from "@/lib/utils";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
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

export const metadata: Metadata = {
  metadataBase: absoluteUrl("/"),
  title: {
    default: "TERANGA LABS — Des clients qui veulent un site",
    template: "%s — TERANGA LABS",
  },
  description:
    "TERANGA LABS connecte les entreprises et entrepreneurs sénégalais avec des développeurs prêts à construire leurs projets web.",
  keywords: [
    "développeur",
    "Sénégal",
    "création de site web",
    "Dakar",
    "marketplace",
    "freelance",
    "Tokens",
  ],
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "fr_SN",
    url: absoluteUrl("/"),
    title: "TERANGA LABS — Des clients qui veulent un site",
    description:
      "Les clients publient leur besoin pour 1 Token. Les développeurs utilisent 1 Token pour débloquer leur contact.",
    siteName: "TERANGA LABS",
    images: [
      {
        url: absoluteUrl("/og.png"),
        width: 1200,
        height: 630,
        alt: "TERANGA LABS — Le marketplace inversé des projets web au Sénégal.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TERANGA LABS — Des clients qui veulent un site",
    description:
      "Marketplace inversé de projets web au Sénégal.",
    images: [absoluteUrl("/og.png")],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
};

/**
 * Données structurées pour les moteurs de recherche.
 *
 * Volontairement minimal : aucune note moyenne, aucun effectif et aucune
 * donnée d'immatriculation, qui seraient invérifiables. Les coordonnées
 * légales complètes restent à renseigner dans app/mentions-legales/page.tsx.
 */
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "TERANGA LABS",
  url: absoluteUrl("/").origin,
  logo: absoluteUrl("/icon.png"),
  description:
    "Marketplace qui met en relation les entreprises sénégalaises et des développeurs web, sur un modèle inversé où les clients publient leurs besoins.",
  areaServed: { "@type": "Country", name: "Sénégal" },
  knowsLanguage: "fr-SN",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    availableLanguage: ["fr"],
    areaServed: "SN",
  },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "TERANGA LABS",
  url: absoluteUrl("/").origin,
  inLanguage: "fr-SN",
  publisher: { "@type": "Organization", name: "TERANGA LABS" },
  // Pas de SearchAction : la recherche des briefs est faite côté client
  // et n'est pas adressable par une URL (?q=), donc la déclarer ici
  // serait une promesse que le site ne tient pas.
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const [user, role] = await Promise.all([getCurrentUser(), getCurrentRole()]);

  return (
    <html lang="fr">
      <body
        className={`${outfit.variable} ${dmSans.variable} ${geistMono.variable} bg-background font-sans text-foreground antialiased`}
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
        <Providers isAuthed={Boolean(user)}>
          <div className="flex min-h-screen flex-col">
            <Navbar
              user={user ? { name: user.user_metadata?.full_name ?? null } : null}
              role={role}
              userId={user?.id ?? null}
            />
            <main className="flex-1 pt-16 pb-28 md:pb-0">{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}