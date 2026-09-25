import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Conditions d’utilisation",
  description:
    "Les règles d’utilisation du service TERANGA LABS : briefs, Tokens et mise en relation.",
};

export default function ConditionsUtilisationPage() {
  return (
    <LegalPage
      title="Conditions d’utilisation"
      lead="En utilisant TERANGA LABS, vous acceptez les règles suivantes."
      updated="24 septembre 2026"
      sections={[
        {
          heading: "Objet du service",
          body: (
            <p>
              TERANGA LABS est un service de mise en relation entre des
              clients qui publient le besoin d’un site web moyennant 1 Token et des
              développeurs qui débloquent le contact avec un Token.
            </p>
          ),
        },
        {
          heading: "Publication d’un brief",
          body: (
            <>
              <p>
                La publication d’un brief coûte 1 Token et est réservée aux
                personnes capables d’assumer les engagements décrits.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>les informations fournies doivent être exactes ;</li>
                <li>le brief doit concerner un projet réel et sérieux ;</li>
                <li>tout usage abusif ou frauduleux est sanctionné par la suppression du compte.</li>
              </ul>
            </>
          ),
        },
        {
          heading: "Tokens",
          body: (
            <>
              <p>
                Un Token permet de débloquer le contact d’un brief. Tarif
                habituel : <strong>1 Token = 2 500 FCFA</strong>.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>un Token est consommé lors du déblocage du contact ;</li>
                <li>l’achat se fait actuellement auprès de l’équipe ; le paiement en ligne arrive bientôt ;</li>
                <li>les transactions sont définitives une fois le contact débloqué, sauf litige avéré.</li>
              </ul>
            </>
          ),
        },
        {
          heading: "Contact direct",
          body: (
            <p>
              Le contact direct (WhatsApp) est l’objet même du service. Les
              développeurs et les clients sont responsables de leurs échanges
              et de la conclusion de leur propre contrat. TERANGA LABS
              n’intervient pas dans les transactions financières entre les
              parties et ne prélève aucune commission.
            </p>
          ),
        },
        {
          heading: "Comportement attendu",
          body: (
            <ul className="list-disc space-y-1 pl-5">
              <li>pas de spam, de harcèlement ou de sollicitation hors sujet ;</li>
              <li>pas de vente de contacts débloqués à des tiers ;</li>
              <li>tout signalement est examiné par l’équipe.</li>
            </ul>
          ),
        },
        {
          heading: "Propriété intellectuelle",
          body: (
            <p>
              Le contenu d’un brief appartient à son auteur (le client). Les
              développeurs peuvent l’utiliser uniquement pour répondre à ce
              brief. La marque, les textes et l’identité visuelle de TERANGA
              LABS ne peuvent pas être réutilisés sans autorisation écrite.
            </p>
          ),
        },
        {
          heading: "Remboursements et litiges",
          body: (
            <p>
              Un Token consommé sur un contact ne peut pas être remboursé, sauf
              litige avéré (contact frauduleux, brief fictif) signalé dans un
              délai raisonnable via le formulaire de signalement. La décision
              est prise à la discrétion de l’équipe, après vérification des
              échanges.
            </p>
          ),
        },
        {
          heading: "Responsabilité",
          body: (
            <p>
              TERANGA LABS fournit une mise en relation. La qualité du travail
              livré, le respect des délais et le contenu des projets relèvent
              de la responsabilité exclusive du développeur, et l’exactitude
              du brief de celle du client. Notre responsabilité est limitée au
              montant des Tokens concernés.
            </p>
          ),
        },
        {
          heading: "Évolution du service",
          body: (
            <p>
              TERANGA LABS évolue en continu : tarifs, règles et fonctionnalités
              peuvent changer. Les conditions en vigueur sont celles publiées
              sur cette page. Une utilisation du service après une mise à jour
              vaut acceptation des nouvelles règles.
            </p>
          ),
        },
        {
          heading: "Signaler un problème",
          body: (
            <p>
              Pour signaler un abus, une fraude ou une infraction aux
              présentes conditions, écrivez-nous à{" "}
              <a
                href="mailto:contact@terangalabs.sn"
                className="font-medium text-[#E86A2C] underline underline-offset-2"
              >
                contact@terangalabs.sn
              </a>{" "}
              ou utilisez le bouton de signalement présent sur chaque contenu.
            </p>
          ),
        },
        {
          heading: "Coordonnées pour les notifications",
          body: (
            <p>
              Toutes les notifications légales sont adressées à{" "}
              contact@terangalabs.sn. Merci de conserver un accès valide à
              votre adresse e-mail de connexion.
            </p>
          ),
        },
        {
          heading: "Modification et suspension",
          body: (
            <p>
              TERANGA LABS peut suspendre tout compte en cas de non-respect des
              présentes conditions, et se réserve le droit de faire évoluer le
              service et ses tarifs. En cas de litige, la loi sénégalaise est
              applicable et les tribunaux de Dakar sont compétents.
            </p>
          ),
        },
      ]}
    />
  );
}