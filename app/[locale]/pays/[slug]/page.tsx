import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFlagUrl } from "@/lib/countries";
import { findCountryBySlug, slugifyPlace } from "@/lib/geography";
import { absoluteUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Pages pays (P1, C2) : une URL stable et partageable par pays du
 * périmètre (§2). Seules des données RÉELLES sont affichées : les
 * régions proviennent du référentiel pays (`lib/countries.ts`), les
 * compteurs proviennent de la table `requests`. Jamais de chiffre
 * inventé (règle §3 du cahier).
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const country = findCountryBySlug(slug);
  if (!country) {
    return { title: "Pays introuvable", robots: { index: false, follow: false } };
  }

  return {
    title: `Développeurs web en ${country.nameFr}`,
    description: `Trouvez un développeur web en ${country.nameFr} pour votre site, votre boutique en ligne ou votre application. Publiez votre brief et recevez les réponses des développeurs.`,
    alternates: { canonical: `/pays/${slugifyPlace(country.nameFr)}` },
    openGraph: {
      title: `Développeurs web en ${country.nameFr} — Devmarket`,
      description: `Les régions couvertes et les briefs réels de ${country.nameFr}, publiés par des clients Devmarket.`,
      url: absoluteUrl(`/pays/${slugifyPlace(country.nameFr)}`),
    },
  };
}

type CountryBrief = { id: string; client_city: string | null };

async function getRegionCounts(countrySlug: string): Promise<Map<string, number>> {
  const country = findCountryBySlug(countrySlug);
  const supabase = await createClient();
  if (!country || !supabase) return new Map();

  const regions = country.regions.map((r) => r.name);
  if (regions.length === 0) return new Map();

  const { data } = await supabase
    .from("requests")
    .select("id, client_city")
    .eq("status", "ouvert")
    .eq("hidden", false)
    .in("client_city", regions);

  const counts = new Map<string, number>();
  for (const b of (data ?? []) as CountryBrief[]) {
    if (b.client_city) {
      counts.set(b.client_city, (counts.get(b.client_city) ?? 0) + 1);
    }
  }
  return counts;
}

export default async function CountryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const country = findCountryBySlug(slug);
  if (!country) notFound();

  const regionCounts = await getRegionCounts(slug);
  const totalOpen = regionCounts.size
    ? [...regionCounts.values()].reduce((a, b) => a + b, 0)
    : 0;
  const countrySlug = slugifyPlace(country.nameFr);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Développeurs web en ${country.nameFr}`,
    description: `Les briefs web réels publiés en ${country.nameFr}.`,
    url: absoluteUrl(`/pays/${countrySlug}`),
    inLanguage: "fr",
    isPartOf: { "@type": "WebSite", name: "Devmarket", url: absoluteUrl("/").origin },
  };

  return (
    <div className="bg-surface py-14 md:py-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="container-tl">
        <div className="mx-auto max-w-4xl">
          <p className="inline-flex items-center gap-2 text-sm font-medium text-primary">
            {getFlagUrl(country.code, 24) ? (
              <Image
                src={getFlagUrl(country.code, 24)}
                alt=""
                width={24}
                height={16}
                className="rounded-sm"
              />
            ) : null}
            {country.nameFr}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            Développeurs web en {country.nameFr}
          </h1>
          <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
            Publiez votre besoin en {country.nameFr} et recevez en quelques
            minutes les réponses des développeurs actifs. Les prix sont
            affichés en FCFA.{" "}
            {totalOpen > 0
              ? `${totalOpen} brief${totalOpen > 1 ? "s" : ""} ouvré${totalOpen > 1 ? "s" : ""} en ce moment dans le pays.`
              : "Les briefs publiés y seront affichés ici dès leur arrivée."}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button className="h-10 rounded-xl" render={<Link href="/poster">Publier mon brief</Link>} />
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              render={
                <Link href={`/briefs?country=${country.code}`}>Tous les briefs</Link>
              }
            />
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              render={
                <Link href={`/dev?city=${encodeURIComponent(country.nameFr)}`}>
                  Développeurs en {country.nameFr}
                </Link>
              }
            />
          </div>

          <section className="mt-12">
            <h2 className="text-lg font-semibold tracking-tight">
              Régions couvertes
            </h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {country.regions.map((region) => {
                const count = regionCounts.get(region.name) ?? 0;
                return (
                  <li key={region.code}>
                    <Link
                      href={`/briefs?country=${country.code}&region=${encodeURIComponent(region.name)}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-hairline bg-card px-4 py-3 text-sm transition-colors hover:border-primary/40"
                    >
                      <span className="inline-flex items-center gap-2">
                        <MapPin className="size-3.5 text-muted-foreground" aria-hidden="true" />
                        {region.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {count > 0
                          ? `${count} brief${count > 1 ? "s" : ""}`
                          : "—"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <p className="mt-10 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
            Les compteurs proviennent des briefs réellement publiés sur la
            plateforme. Les contacts clients restent privés : un développeur
            utilise un Token pour débloquer une mise en relation.
          </p>
        </div>
      </div>
    </div>
  );
}