import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { BRAND, LEGAL_PUBLISHER } from "@/components/landing/content";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "Mentions légales de TERANGA LABS, le marketplace inversé du Sénégal.",
};

export default function MentionsLegalesPage() {
  return (
    <LegalPage
      title="Mentions légales"
      lead="Informations relatives à l’éditeur du service TERANGA LABS."
      updated="24 septembre 2026"
      sections={[
        {
          heading: "Éditeur du service",
          body: (
            <>
              <p>
                Le site {BRAND} est édité par <strong>{LEGAL_PUBLISHER}</strong>,
                société de services numériques basée à <strong>Dakar, Sénégal</strong>.
                La marque {BRAND} est la dénomination commerciale du service.
              </p>
              <p>
                Email de contact :{" "}
                <a
                  href="mailto:contact@terangalabs.sn"
                  className="font-medium text-primary underline underline-offset-2"
                >
                  contact@terangalabs.sn
                </a>
              </p>
            </>
          ),
        },
        {
          heading: "Directeur de la publication",
          body: (
            <p>
              Le directeur de la publication est le représentant légal de{" "}
              {LEGAL_PUBLISHER}.
            </p>
          ),
        },
        {
          heading: "Identité légale",
          body: (
            <p>
              Adresse du siège, NINEA et RCCM de {LEGAL_PUBLISHER} :{" "}
              <span className="italic text-muted-foreground">
                [à compléter]
              </span>
              . Ces informations sont publiées dès réception de l’immatriculation
              administrative. En attendant, pour toute demande, écrivez à{" "}
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
        {
          heading: "Hébergement",
          body: (
            <>
              <p>
                Le site est hébergé par{" "}
                <strong>Vercel Inc.</strong>, 340 S Lemon Ave #4133, Walnut, CA
                91789, États-Unis —{" "}
                <a
                  href="https://vercel.com"
                  className="font-medium text-primary underline underline-offset-2"
                >
                  vercel.com
                </a>
                .
              </p>
              <p>
                La base de données du service est gérée par{" "}
                <strong>Supabase Inc.</strong> via une infrastructure cloud
                sécurisée, séparée de l’hébergement du site.
              </p>
            </>
          ),
        },
        {
          heading: "Données personnelles et cookies",
          body: (
            <>
              <p>
                Les données personnelles (nom, WhatsApp, contenu des briefs)
                sont traitées pour la seule mise en relation décrite dans la{" "}
                <a
                  href="/politique-de-confidentialite"
                  className="font-medium text-primary underline underline-offset-2"
                >
                  politique de confidentialité
                </a>
                . Le détail des cookies est expliqué dans la{" "}
                <a
                  href="/cookies"
                  className="font-medium text-primary underline underline-offset-2"
                >
                  politique de cookies
                </a>
                .
              </p>
            </>
          ),
        },
        {
          heading: "Responsabilités",
          body: (
            <p>
              Les échanges entre clients et développeurs sont effectués sous
              leur propre responsabilité. TERANGA LABS fournit la mise en
              relation (Tokens, briefs, messagerie) et n’intervient pas dans la
              conclusion des contrats ni dans les transactions financières
              entre les parties. Des efforts raisonnables sont faits pour
              prévenir les abus et la fraude, sans garantie de résultat.
            </p>
          ),
        },
        {
          heading: "Droit applicable",
          body: (
            <p>
              Les présentes mentions sont soumises au droit sénégalais. En cas
              de litige, et à défaut de résolution amiable, les tribunaux de
              Dakar sont compétents.
            </p>
          ),
        },
        {
          heading: "Propriété intellectuelle",
          body: (
            <>
              <p>
                L’ensemble des éléments du site — textes, visuels, logo,
                structure, mise en page — est la propriété exclusive de TERANGA
                LABS ou de ses partenaires. Toute reproduction, représentation
                ou diffusion sans autorisation préalable est interdite.
              </p>
              <p>
                Les marques et noms cités à titre d’exemple (applications de
                marketplace) appartiennent à leurs propriétaires respectifs.
              </p>
            </>
          ),
        },
        {
          heading: "Modification des mentions",
          body: (
            <p>
              TERANGA LABS se réserve le droit de modifier les présentes
              mentions à tout moment. Elles sont opposables dès leur mise en
              ligne.
            </p>
          ),
        },
      ]}
    />
  );
}