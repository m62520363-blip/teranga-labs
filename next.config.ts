import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

/** Charge la config de requête i18n depuis ./i18n/request.ts (emplacement par défaut). */
const withNextIntl = createNextIntlPlugin();

/**
 * Headers posés ici s'appliquent à TOUTES les routes (dont les assets
 * statiques que le matcher du middleware exclut). Les headers relatifs au
 * contenu (CSP, X-Frame-Options, nosniff, Referrer-Policy,
 * Permissions-Policy) sont posés par `middleware.ts` qui s'exécute en
 * dernier et les écraserait : on ne garde ici que le HSTS, qui doit
 * couvrir aussi les fichiers statiques.
 */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    // AVIF en priorité (meilleure compression), WebP en repli.
    formats: ["image/avif", "image/webp"],
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