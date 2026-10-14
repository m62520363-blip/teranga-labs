import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Globe } from "lucide-react";
import { COUNTRIES } from "@/lib/countries";
import { absoluteUrl } from "@/lib/utils";
import { slugifyRegion } from "@/lib/region-slugs";

export const metadata: Metadata = {
  title: "Développeurs web en Afrique de l'Ouest",
  description:
    "Les 9 pays et leurs régions : trouvez ou publiez un brief de développement web à Dakar, Abidjan, Bamako, Ouagadougou, Conakry, Cotonou, Lomé et partout ailleurs.",
  alternates: { canonical: "/ville" },
};

export default function RegionsIndexPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: absoluteUrl("/").origin },
      { "@type": "ListItem", position: 2, name: "Villes", item: absoluteUrl("/ville") },
    ],
  };

  return (
    <div className="bg-surface py-14 md:py-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="container-tl">
        <div className="mx-auto max-w-4xl">
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
            <Globe className="size-4" aria-hidden="true" />
            Afrique de l&apos;Ouest
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            Développeurs web par région
          </h1>
          <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
            TERANGA LABS couvre le Sénégal, la Côte d&apos;Ivoire, le Mali, le
            Burkina Faso, le Niger, la Guinée, la Guinée-Bissau, le Bénin et le
            Togo. Choisissez votre région pour voir les briefs réellement
            publiés.
          </p>

          <div className="mt-10 flex flex-col gap-10">
            {COUNTRIES.map((country) => (
              <section key={country.code}>
                <h2 className="text-lg font-semibold tracking-tight">
                  {country.nameFr}
                </h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {country.regions.map((region) => (
                    <li key={`${country.code}-${region.code}`}>
                      <Link
                        href={`/ville/${slugifyRegion(region.name)}`}
                        className="group flex items-center justify-between rounded-2xl border border-hairline bg-card px-5 py-4 transition-colors hover:border-primary/40"
                      >
                        <span className="font-medium">{region.name}</span>
                        <ArrowRight
                          className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
