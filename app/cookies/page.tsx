import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Politique de cookies",
  description:
    "Comment TERANGA LABS utilise les cookies et traceurs pour faire fonctionner le service et vous garder connecté.",
};

const cookieGroups = [
  {
    name: "Cookies essentiels d’authentification",
    description:
      "Créés par Supabase Auth, ils gardent votre session active et sécurisée (30 jours). Supprimés quand vous vous déconnectez. Ils sont strictement nécessaires au fonctionnement : sans eux, impossible de se connecter ou d’accéder à votre espace.",
  },
  {
    name: "Cookies techniques Next.js",
    description:
      "Utilisés uniquement pour le rendu des pages et la navigation. Aucune donnée personnelle n’y est stockée.",
  },
  {
    name: "Préférences locales (localStorage)",
    description:
      "Des réglages d’interface comme « réduire les animations » sont enregistrés sur votre appareil. Ils ne quittent jamais votre navigateur.",
  },
  {
    name: "Aucun cookie publicitaire ou de suivi",
    description:
      "TERANGA LABS n’utilise pas de publicité ciblée, ne transmet aucun cookie à des régies publicitaires et ne revend aucune donnée.",
  },
];

export default function CookiesPage() {
  return (
    <LegalPage
      title="Politique de cookies"
      lead="Nous gardons votre session connectée avec des cookies, et rien d’autre."
      updated="24 septembre 2026"
      sections={[
        {
          heading: "Ce que sont les cookies",
          body: (
            <p>
              Un cookie est un petit fichier stocké par votre navigateur. Chez
              TERANGA LABS, les cookies servent à une seule chose :{" "}
              <strong>vous garder connecté</strong> de façon sécurisée pendant
              jusqu’à 30 jours, comme vous l’avez demandé.
            </p>
          ),
        },
        {
          heading: "Les cookies que nous utilisons",
          body: (
            <div className="space-y-4">
              {cookieGroups.map((group) => (
                <div
                  key={group.name}
                  className="rounded-xl border border-hairline bg-[#141414] p-4"
                >
                  <h3 className="text-sm font-semibold tracking-tight text-foreground">
                    {group.name}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {group.description}
                  </p>
                </div>
              ))}
            </div>
          ),
        },
        {
          heading: "Session persistante (30 jours)",
          body: (
            <>
              <p>
                Par défaut, lorsque vous vous connectez, un cookie de session
                d’une durée de <strong>30 jours</strong> est posé. Vous restez
                connecté entre deux visites, ce qui évite de ressaisir votre
                mot de passe.
              </p>
              <p>
                Vous pouvez à tout moment mettre fin à cette session en
                utilisant le bouton <strong>« Déconnexion »</strong> dans la
                barre de navigation : le cookie est alors immédiatement
                supprimé de votre appareil.
              </p>
            </>
          ),
        },
        {
          heading: "Gestion et consentement",
          body: (
            <p>
              Les cookies essentiels d’authentification ne demandent pas de
              consentement : ils sont indispensables au service. Les
              préférences locales peuvent être effacées à tout moment depuis
              les réglages de votre navigateur. Si vous bloquez tous les
              cookies, la connexion à TERANGA LABS sera impossible.
            </p>
          ),
        },
        {
          heading: "Contact",
          body: (
            <p>
              Une question sur cette politique ? Écrivez-nous à{" "}
              <a
                href="mailto:contact@terangalabs.sn"
                className="font-medium text-primary underline underline-offset-2"
              >
                contact@terangalabs.sn
              </a>
              .
            </p>
          ),
        },
      ]}
    />
  );
}