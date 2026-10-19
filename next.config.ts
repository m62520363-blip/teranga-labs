import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

/** Charge la config de requête i18n depuis ./i18n/request.ts (emplacement par défaut). */
const withNextIntl = createNextIntlPlugin();

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Content-Security-Policy",
    value:
      "frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://virihuuksoepswccxsne.supabase.co",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      // Drapeaux (référentiel statique des pays).
      { protocol: "https", hostname: "flagcdn.com" },
      // Fichiers publics hébergés sur le stockage Supabase du projet.
      { protocol: "https", hostname: "virihuuksoepswccxsne.supabase.co" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      // /signup est une vraie page (formulaire dédié) : plus de redirection
      // vers /login?mode=signup. /inscription reste l'alias français.
      { source: "/inscription", destination: "/signup", permanent: false },
      { source: "/connexion", destination: "/login", permanent: false },
      { source: "/profile", destination: "/dashboard?tab=profil", permanent: false },
      { source: "/profil", destination: "/dashboard?tab=profil", permanent: false },
      { source: "/settings", destination: "/parametres", permanent: false },
      { source: "/messages", destination: "/conversations", permanent: false },
      { source: "/chat", destination: "/conversations", permanent: false },
      { source: "/checkout", destination: "/tokens", permanent: false },
      { source: "/panier", destination: "/tokens", permanent: false },
      { source: "/confirmation", destination: "/tokens", permanent: false },
    ];
  },
};

export default withNextIntl(nextConfig);