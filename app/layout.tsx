import type { Metadata } from "next";
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
  openGraph: {
    type: "website",
    locale: "fr_SN",
    url: absoluteUrl("/"),
    title: "TERANGA LABS — Des clients qui veulent un site",
    description:
      "Les clients publient leur besoin pour 1 Token. Les développeurs utilisent 1 Token pour débloquer leur contact.",
    siteName: "TERANGA LABS",
  },
  twitter: {
    card: "summary",
    title: "TERANGA LABS — Des clients qui veulent un site",
    description:
      "Marketplace inversé de projets web au Sénégal.",
  },
  robots: {
    index: true,
    follow: true,
  },
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
        className={`${outfit.variable} ${dmSans.variable} ${geistMono.variable} bg-[#0A0A0A] font-sans text-foreground antialiased`}
      >
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