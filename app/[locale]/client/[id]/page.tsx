import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatFCFA, formatDate } from "@/lib/formatting";

export const dynamic = "force-dynamic";

// ClientProfile type removed - not needed

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Profil client · Devmarket`,
    robots: { index: false, follow: false },
  };
}

export default async function ClientPublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) notFound();

  // Récupérer les briefs publiés par ce client
  const { data: briefs } = await supabase
    .from("requests")
    .select("id, client_name, client_city, project_type, budget, status, created_at")
    .eq("client_id", id)
    .eq("hidden", false)
    .order("created_at", { ascending: false })
    .limit(20);

  if (!briefs || briefs.length === 0) notFound();

  const clientName = briefs[0]?.client_name ?? "Client";
  const clientCity = briefs[0]?.client_city ?? "";

  return (
    <div className="bg-surface py-14 md:py-20">
      <div className="container-tl">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/briefs"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground"
          >
            Tous les projets
          </Link>

          <div className="mt-6 rounded-2xl border border-hairline bg-card p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-4">
              <div className="flex size-16 items-center justify-center rounded-full bg-primary-soft text-2xl font-bold text-primary">
                {clientName.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">{clientName}</h1>
                {clientCity ? (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="size-4" aria-hidden="true" />
                    {clientCity}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  Membre depuis {formatDate(briefs[briefs.length - 1]?.created_at ?? new Date().toISOString())}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-hairline bg-muted p-4">
                <p className="text-xs text-muted-foreground">Projets publiés</p>
                <p className="mt-1 text-2xl font-semibold">{briefs.length}</p>
              </div>
              <div className="rounded-xl border border-hairline bg-muted p-4">
                <p className="text-xs text-muted-foreground">Projets terminés</p>
                <p className="mt-1 text-2xl font-semibold">
                  {briefs.filter((b) => b.status === "terminé").length}
                </p>
              </div>
              <div className="rounded-xl border border-hairline bg-muted p-4">
                <p className="text-xs text-muted-foreground">Budget total</p>
                <p className="mt-1 text-2xl font-semibold">
                  {formatFCFA(briefs.reduce((sum, b) => sum + (b.budget || 0), 0))}
                </p>
              </div>
            </div>
          </div>

          {/* Projets publiés */}
          <div className="mt-8">
            <h2 className="text-lg font-semibold tracking-tight">
              Projets publiés ({briefs.length})
            </h2>
            <div className="mt-4 space-y-3">
              {briefs.map((brief) => (
                <Link
                  key={brief.id}
                  href={`/briefs/${brief.id}`}
                  className="block rounded-2xl border border-hairline bg-card p-4 shadow-sm transition-colors hover:border-primary/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold tracking-tight">{brief.client_name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {brief.project_type} · {brief.client_city} · {formatFCFA(brief.budget)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {brief.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
