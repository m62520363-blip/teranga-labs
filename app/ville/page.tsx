import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { SENEGAL_REGIONS } from "@/lib/tokens";
import { absoluteUrl } from "@/lib/utils";
import { slugifyRegion } from "@/lib/region-slugs";

export const metadata: Metadata = {
  title: "Développeurs web au Sénégal",
  description:
    "Les 14 régions du Sénégal : trouvez ou publiez un brief de développement web à Dakar, Thiès, Saint-Louis, Ziguinchor et partout ailleurs.",
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
        <div className="mx-auto max-w-3xl">
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
            <MapPin className="size-4" aria-hidden="true" />
            Sénégal
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            Développeurs web par région
          </h1>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            TERANGA LABS couvre l&apos;ensemble du territoire sénégalais. Choisissez
            votre région pour voir les briefs réellement publiés.
          </p>

          <ul className="mt-10 grid gap-3 sm:grid-cols-2">
            {SENEGAL_REGIONS.map((region) => (
              <li key={region}>
                <Link
                  href={`/ville/${slugifyRegion(region)}`}
                  className="group flex items-center justify-between rounded-2xl border border-hairline bg-card px-5 py-4 transition-colors hover:border-primary/40"
                >
                  <span className="font-medium">{region}</span>
                  <ArrowRight
                    className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
