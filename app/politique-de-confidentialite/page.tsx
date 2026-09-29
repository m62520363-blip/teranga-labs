import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description:
    "Comment TERANGA LABS collecte, utilise et protège vos données personnelles.",
};

export default function PolitiqueDeConfidentialitePage() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      lead="Vos données, votre vie privée : voici comment TERANGA LABS les traite."
      updated="24 septembre 2026"
      sections={[
        {
          heading: "Données collectées",
          body: (
            <>
              <p>Lors de l’utilisation du service, nous collectons :</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>les données de votre brief : nom, région, type de projet, budget et description ;</li>
                <li>votre numéro de WhatsApp, utilisé pour le contact direct ;</li>
                <li>les données de navigation strictement nécessaires au fonctionnement.</li>
              </ul>
            </>
          ),
        },
        {
          heading: "Pourquoi collectons-nous ces données ?",
          body: (
            <>
              <p>Ces données servent uniquement à :</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>mettre en relation clients et développeurs ;</li>
                <li>vous permettre de débloquer un contact avec un Token ;</li>
                <li>assurer la modération et prévenir les abus.</li>
              </ul>
              <p>
                Nous ne vendons pas vos données, et nous ne les partageons
                jamais à des fins publicitaires.
              </p>
            </>
          ),
        },
        {
          heading: "Partage et affichage",
          body: (
            <p>
              Le contact d’un brief (numéro WhatsApp) n’est visible que par les
              développeurs qui débloquent le contact via un Token. Aucune autre
              divulgation n’est faite sans votre accord.
            </p>
          ),
        },
        {
          heading: "Durée de conservation",
          body: (
            <p>
              Les données sont conservées le temps nécessaire à la fourniture
              du service : votre session reste active 30 jours (voir la{" "}
              <a
                href="/cookies"
                className="font-medium text-primary underline underline-offset-2"
              >
                politique de cookies
              </a>
              ), vos briefs restent visibles tant qu’ils sont ouverts, et les
              données de compte sont supprimées sur demande. Les journaux de
              sécurité sont conservés 12 mois, puis anonymisés.
            </p>
          ),
        },
        {
          heading: "Sous-traitants",
          body: (
            <p>
              Notre infrastructure est hébergée chez un prestataire web de
              type Supabase (base de données, authentification, stockage). Ces
              prestataires ne peuvent pas utiliser vos données pour leurs
              propres besoins et n’y accèdent que pour garantir le bon
              fonctionnement du service.
            </p>
          ),
        },
        {
          heading: "Sécurité",
          body: (
            <>
              <p>
                Nous appliquons des mesures techniques et organisationnelles
                adaptées à la sensibilité des données :
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>mots de passe hachés, jamais stockés en clair ;</li>
                <li>sessions sécurisées avec cookies httpOnly ;</li>
                <li>accès aux données restreint selon le rôle (client ou développeur) ;</li>
                <li>WhatsApp masqué par défaut, révélé uniquement lors d’une discussion.</li>
              </ul>
            </>
          ),
        },
        {
          heading: "Mineurs",
          body: (
            <p>
              Le service est réservé aux personnes capables d’assumer des
              engagements contractuels. Une personne mineure ne peut pas
              utiliser TERANGA LABS sans le consentement d’un représentant
              légal.
            </p>
          ),
        },
        {
          heading: "Cookies",
          body: (
            <p>
              Les cookies que nous utilisons servent exclusivement à
              l’authentification et au fonctionnement technique. Ils ne sont
              jamais utilisés à des fins publicitaires.
            </p>
          ),
        },
        {
          heading: "Vos droits",
          body: (
            <p>
              Conformément à la loi sénégalaise n° 2008-12 sur la protection
              des données personnelles, vous pouvez demander l’accès, la
              rectification ou la suppression de vos données en écrivant à{" "}
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