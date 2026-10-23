import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getFlagUrl, COUNTRIES, type CountryCode } from "@/lib/countries";
import { allCountrySlugs } from "@/lib/geography";
import { absoluteUrl } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Développeurs web en Afrique de l'Ouest francophone",
  description:
    "Trouvez un développeur web dans les 9 pays du périmètre Devmarket : Sénégal, Côte d'Ivoire, Mali, Burkina Faso, Niger, Guinée, Guinée-Bissau, Bénin et Togo.",
  alternates: { canonical: "/pays" },
  openGraph: {
    title: "Nos pays — Devmarket",
    description: "Le marketplace des projets web des 9 pays d'Afrique de l'Ouest francophone.",
    url: absoluteUrl("/pays"),
  },
};

function CountryCard({ code, slug }: { code: CountryCode; slug: string }) {
  const country = COUNTRIES.find((c) => c.code === code)!;
  return (
    <Link
      href={`/pays/${slug}`}
      aria-label={`Développeurs web et briefs en ${country.nameFr}`}
      className="group flex items-center gap-4 rounded-2xl border border-hairline bg-card p-5 transition-colors hover:border-primary/40"
    >
      <Image
        src={getFlagUrl(country.code, 48)}
        alt={`Drapeau ${country.nameFr}`}
        width={48}
        height={32}
        className="h-8 w-12 rounded-sm object-cover shadow-sm"
      />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{country.nameFr}</p>
        <p className="text-sm text-muted-foreground">
          {country.currencyLabel} · +{country.phoneCode.slice(1)}
        </p>
      </div>
      <ArrowRight
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
        aria-hidden="true"
      />
    </Link>
  );
}

export default function CountriesPage() {
  const slugs = new Map(allCountrySlugs().map((s) => [s.country.code, s.slug]));

  return (
    <div className="bg-surface py-14 md:py-20">
      <div className="container-tl">
        <div className="mx-auto max-w-4xl">
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
            Afrique de l&apos;Ouest francophone
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            Des développeurs web dans les 9 pays du périmètre
          </h1>
          <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
            Devmarket connecte les clients et les développeurs des 9 pays de
            diffusion : Sénégal, Côte d&apos;Ivoire, Mali, Burkina Faso, Niger,
            Guinée, Guinée-Bissau, Bénin et Togo. Choisissez un pays pour
            découvrir les régions couvertes et publier un brief.
          </p>

          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {COUNTRIES.map((country) => (
              <li key={country.code}>
                <CountryCard code={country.code} slug={slugs.get(country.code)!} />
              </li>
            ))}
          </ul>

          <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
            Les prix sont affichés en FCFA. Les moyens de paiement mobiles
            disponibles sont indiqués sur chaque page du pays dès que
            l&apos;intégration est confirmée.
          </p>
        </div>
      </div>
    </div>
  );
}

export function generateStaticParams() {
  return allCountrySlugs().map(({ slug }) => ({ slug }));
}