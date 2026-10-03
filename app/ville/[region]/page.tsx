import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, MapPin, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PROJECT_TYPE_LABELS } from "@/lib/tokens";
import { BRIEFS_COLUMNS } from "@/lib/briefs-pagination";
import { findRegionBySlug, slugifyRegion } from "@/lib/region-slugs";
import { formatFCFA, formatDate } from "@/lib/formatting";
import { absoluteUrl } from "@/lib/utils";
import { projectTypeLabel } from "@/lib/dev-missions-labels";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

/**
 * Pages région : une URL stable et partageable par région du Sénégal.
 *
 * Les pages sont rendues dynamiquement (`force-dynamic`) car elles comptent
 * les briefs réels du moment. Générer du statique à la compilation figerait
 * des compteurs faux, ce qui est exactement le piège qu'on a évité sur la
 * home à l'étape 1.
 */
export const dynamic = "force-dynamic";

type RegionBrief = {
  id: string;
  client_name: string;
  client_city: string | null;
  project_type: string;
  budget: number;
  description: string;
  created_at: string;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string }>;
}): Promise<Metadata> {
  const { region: rawSlug } = await params;
  const region = findRegionBySlug(rawSlug);
  if (!region) {
    return { title: "Région introuvable", robots: { index: false, follow: false } };
  }

  return {
    title: `Développeurs web à ${region}`,
    description: `Trouvez un développeur web à ${region} (Sénégal) pour créer votre site, votre boutique en ligne ou votre application. Publiez votre besoin depuis TERANGA LABS.`,
    alternates: { canonical: `/ville/${slugifyRegion(region)}` },
    openGraph: {
      title: `Développeurs web à ${region} — TERANGA LABS`,
      description: `Les briefs web réels de ${region}, publiés par des entreprises et entrepreneurs sénégalais.`,
      url: absoluteUrl(`/ville/${slugifyRegion(region)}`),
    },
  };
}

async function getRegionBriefs(region: string): Promise<RegionBrief[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("requests")
    .select(BRIEFS_COLUMNS)
    .eq("status", "ouvert")
    .eq("hidden", false)
    .eq("client_city", region)
    .order("created_at", { ascending: false })
    .limit(12);
  return (data ?? []) as RegionBrief[];
}

export default async function RegionPage({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  const { region: rawSlug } = await params;
  const region = findRegionBySlug(rawSlug);
  if (!region) notFound();

  const briefs = await getRegionBriefs(region);
  const slug = slugifyRegion(region);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Développeurs web à ${region}`,
    description: `Les briefs web réels publiés à ${region}, au Sénégal.`,
    url: absoluteUrl(`/ville/${slug}`),
    inLanguage: "fr-SN",
    isPartOf: { "@type": "WebSite", name: "TERANGA LABS", url: absoluteUrl("/").origin },
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
            <MapPin className="size-4" aria-hidden="true" />
            Sénégal
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            Développeurs web à {region}
          </h1>
          <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
            Voici les besoins que les entreprises et entrepreneurs de {region}
            ont publiés sur TERANGA LABS. Publiez le vôtre : les développeurs
            de la région vous répondent directement.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button className="h-10 rounded-xl" render={<Link href="/poster">Publier mon brief</Link>} />
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              render={<Link href="/briefs">Tous les briefs</Link>}
            />
          </div>

          <h2 className="mt-12 text-lg font-semibold tracking-tight">
            {briefs.length > 0
              ? `${briefs.length} brief${briefs.length > 1 ? "s" : ""} ouvert${briefs.length > 1 ? "s" : ""} à ${region}`
              : `Aucun brief ouvert à ${region} pour le moment`}
          </h2>

          {briefs.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-hairline bg-card p-6 text-sm leading-relaxed text-muted-foreground">
              Il n&apos;y a pas encore de demande publiée dans cette région. Vous
              pouvez être le premier : votre brief sera visible par tous les
              développeurs du pays.
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {briefs.map((brief) => (
                <li key={brief.id}>
                  <Link
                    href={`/brief/${brief.id}`}
                    className={cn(
                      "group block rounded-2xl border border-hairline bg-card p-5 transition-colors",
                      "hover:border-primary/40"
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {projectTypeLabel(brief.project_type)}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {brief.description}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-primary">
                        {formatFCFA(brief.budget)}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{brief.client_name}</span>
                      <span className="inline-flex items-center gap-1">
                        {formatDate(brief.created_at)}
                        <ArrowRight
                          className="size-3.5 transition-transform group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <section className="mt-14">
            <h2 className="text-lg font-semibold tracking-tight">
              Types de projets demandés à {region}
            </h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {Object.entries(PROJECT_TYPE_LABELS).map(([value, label]) => (
                <li key={value}>
                  <Link
                    href={`/briefs?type=${encodeURIComponent(value)}`}
                    className="inline-flex rounded-full border border-hairline bg-card px-3.5 py-1.5 text-sm transition-colors hover:border-primary/40"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <p className="mt-12 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
            Les briefs affichés ici sont ceux réellement publiés sur la
            plateforme. Les contacts clients restent privés : un développeur
            utilise un Token pour débloquer une mise en relation.
          </p>
        </div>
      </div>
    </div>
  );
}
