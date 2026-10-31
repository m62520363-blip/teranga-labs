import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Award, CheckCircle2, Crown, ShieldCheck, Trophy, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { COUNTRIES } from "@/lib/countries";
import { Flag } from "@/components/ui/Flag";
import { Section, SectionHeader } from "@/components/landing/section";
import { Reveal } from "@/components/reveal";
import { Scene3D } from "@/components/landing/scene-3d";
import { cn } from "cn";

export const metadata: Metadata = {
  title: "Classement des développeurs",
  description:
    "Classement mensuel mondial des développeurs : missions terminées par mois, 50 points par projet. Les 3 premiers reçoivent 10, 7 et 4 contacts bonus, et chaque pays possède son propre tableau.",
};

export const dynamic = "force-dynamic";

type LeaderboardRow = {
  rank: number;
  developer_id: string;
  username?: string | null;
  full_name?: string | null;
  city?: string | null;
  country?: string | null;
  avatar_url?: string | null;
  completed_projects: number;
  points?: number;
  tokens_awarded: number;
};

type LeaderboardPayload = {
  period?: { year: number; month: number };
  status?: "live" | "settled";
  config?: {
    enabled?: boolean;
    min_projects?: number;
    points_per_project?: number;
    rewards?: Record<string, Record<string, number>>;
  };
  regional: LeaderboardRow[];
  countries: { key: string; rows: LeaderboardRow[] }[];
};

const HEADERS = ["Rang", "Développeur", "Missions terminées", "Points", "Contacts bonus", "Badges"];
const POINTS_PER_PROJECT = 50;

function pointsOf(row: LeaderboardRow): number {
  return row.points ?? row.completed_projects * POINTS_PER_PROJECT;
}

function initialsOf(name: string | null): string {
  if (!name) return "D";
  const parts = name.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((n) => n[0]?.toUpperCase() ?? "").join("") || "D";
}

function countryFromKey(key: string) {
  const k = key.trim().toLowerCase();
  return (
    COUNTRIES.find(
      (c) => c.nameFr.toLowerCase() === k || c.name.toLowerCase() === k || c.code.toLowerCase() === k
    ) ?? null
  );
}

function RewardsLegend({
  rewards,
  scope,
}: {
  rewards: Record<string, number> | undefined;
  scope: string;
}) {
  if (!rewards) {
    return (
      <p className="mt-3 text-xs text-muted-foreground">
        Classement affiché — les contacts bonus sont attribués au classement mondial.
      </p>
    );
  }
  const first = rewards["1"] ?? 0;
  const second = rewards["2"] ?? 0;
  const third = rewards["3"] ?? 0;
  return (
    <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <span className="badge badge-success">
        1<sup>er</sup> {first} contact{first > 1 ? "s" : ""} bonus
      </span>
      <span className="badge badge-muted">
        2<sup>e</sup> {second} contact{second > 1 ? "s" : ""} bonus
      </span>
      <span className="badge badge-muted">
        3<sup>e</sup> {third} contact{third > 1 ? "s" : ""} bonus
      </span>
      <span className="text-xs">Autres rangs : 0 contact bonus — {scope}</span>
    </p>
  );
}

function DeveloperCell({ row }: { row: LeaderboardRow }) {
  const name = row.full_name ?? row.username ?? "Développeur";
  return (
    <div className="flex items-center gap-3">
      {row.avatar_url ? (
        <Image
          src={row.avatar_url}
          alt=""
          width={36}
          height={36}
          unoptimized
          className="size-9 shrink-0 rounded-lg border border-hairline object-cover"
        />
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-xs font-bold text-primary">
          {initialsOf(name)}
        </span>
      )}
      <div className="min-w-0">
        {row.username ? (
          <Link
            href={`/dev/${encodeURIComponent(row.username)}`}
            className="block truncate text-sm font-medium hover:text-primary"
          >
            {name}
          </Link>
        ) : (
          <span className="block truncate text-sm font-medium">{name}</span>
        )}
        {row.city ? (
          <span className="block truncate text-xs text-muted-foreground">{row.city}</span>
        ) : null}
      </div>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning">
        <Crown className="size-3" aria-hidden="true" /> Top 1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">
        <Trophy className="size-3" aria-hidden="true" /> Top 2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground">
        <Award className="size-3" aria-hidden="true" /> Top 3
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">—</span>;
}

function LeaderboardTable({
  rows,
  live,
  emptyLabel,
}: {
  rows: LeaderboardRow[];
  live: boolean;
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="overflow-hidden rounded-2xl border border-hairline bg-card">
        <table className="min-w-full divide-y divide-hairline text-sm">
          <thead>
            <tr className="bg-surface">
              {HEADERS.map((header) => (
                <th
                  key={header}
                  scope="col"
                  className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:px-6"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center sm:px-6">
                <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <UserRound className="size-4 text-primary" aria-hidden="true" />
                  {emptyLabel}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-card">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-hairline text-sm">
          <thead>
            <tr className="bg-surface">
              {HEADERS.map((header) => (
                <th
                  key={header}
                  scope="col"
                  className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:px-6"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map((row) => (
              <tr key={row.developer_id} className={cn(row.rank <= 3 && "bg-primary-soft/30")}>
                <td className="px-4 py-3 sm:px-6">
                  <span className="inline-flex size-7 items-center justify-center rounded-full bg-surface text-xs font-bold">
                    {row.rank}
                  </span>
                </td>
                <td className="px-4 py-3 sm:px-6">
                  <DeveloperCell row={row} />
                </td>
                <td className="px-4 py-3 font-semibold sm:px-6">{row.completed_projects}</td>
                <td className="px-4 py-3 font-semibold text-primary sm:px-6">{pointsOf(row)}</td>
                <td className="px-4 py-3 sm:px-6">
                  {live || row.tokens_awarded <= 0 ? (
                    <span className="text-muted-foreground">à la clôture</span>
                  ) : (
                    <span className="font-semibold text-success">
                      +{row.tokens_awarded} contact{row.tokens_awarded > 1 ? "s" : ""} bonus
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 sm:px-6">
                  <RankBadge rank={row.rank} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function palmarèsLabel(year: number, month: number): string {
  const monthNames = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  ];
  return `${monthNames[month - 1]} ${year}`;
}

export default async function ClassementPage() {
  const supabase = await createClient();

  const localMonth = new Date().getMonth() + 1;
  const localYear = new Date().getFullYear();

  let currentData: LeaderboardPayload | null = null;
  let pastReads: (LeaderboardPayload | null)[] = [];

  if (supabase) {
    const [current, past] = await Promise.all([
      supabase.rpc("get_leaderboard", {}),
      (async () => {
        const results: (LeaderboardPayload | null)[] = [];
        let year = localYear;
        let month = localMonth;
        for (let i = 0; i < 6; i++) {
          month -= 1;
          if (month < 1) {
            month = 12;
            year -= 1;
          }
          if (year < 2000) break;
          const { data } = await supabase.rpc("get_leaderboard", { p_year: year, p_month: month });
          results.push((data as LeaderboardPayload | null) ?? null);
        }
        return results;
      })(),
    ]);
    currentData = (current.data as LeaderboardPayload | null) ?? null;
    pastReads = past;
  } else {
    pastReads = [null, null, null, null, null, null];
  }

  const payload = (currentData ?? null) as LeaderboardPayload | null;
  const config = payload?.config;
  const live = payload?.status === "live";
  const regional = payload?.regional ?? [];
  const countries = payload?.countries ?? [];
  const periodLabel = payload?.period ? palmarèsLabel(payload.period.year, payload.period.month) : "";

  const countryMeta = new Map(countries.map((c) => [c.key, countryFromKey(c.key)]));

  return (
    <div className="bg-background">
      <Section ariaLabel="Classement des développeurs">
        <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <SectionHeader
            align="left"
            eyebrow="Classement mensuel"
            title="Le classement des développeurs"
            lead="Chaque mois, le classement mondial et le classement de chaque pays récompensent les développeurs les plus actifs, calculés sur les missions réellement terminées — 50 points par projet, 10/7/4 contacts bonus pour le podium mondial."
          />
          <Scene3D variant="ranking" className="hidden lg:block" />
        </div>

        {config?.enabled === false && (
          <p className="mx-auto mt-6 max-w-xl rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-center text-xs text-warning">
            Récompenses désactivées via la configuration.
          </p>
        )}

        <Reveal className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hairline bg-card px-5 py-4">
            <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              {live ? (
                <span className="size-2 rounded-full bg-success" aria-hidden="true" />
              ) : (
                <ShieldCheck className="size-4 text-success" aria-hidden="true" />
              )}
              {live ? (
                <>Classement live du mois en cours — actualisé à chaque lecture.</>
              ) : (
                <>Mois clos ({periodLabel}) — récompenses attribuées et verrouillées.</>
              )}
            </p>
            <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Award className="size-3.5 text-primary" aria-hidden="true" />
              Seuil d&apos;apparition : {config?.min_projects ?? 2} missions terminées —{" "}
              {config?.points_per_project ?? POINTS_PER_PROJECT} points par projet
            </p>
          </div>
        </Reveal>

        <section className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                Classement mondial{" "}
                <span className="text-muted-foreground">(tous les pays)</span>
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {live ? "Mois en cours — données de missions en direct." : `${periodLabel} — classement archivé.`}
              </p>
            </div>
            <span className="chip gap-2 bg-card/85 border-hairline backdrop-blur">
              <Crown className="size-3.5 text-primary" aria-hidden="true" />
              Top 3 récompensé
            </span>
          </div>

          <div className="mt-5">
            <LeaderboardTable
              rows={regional}
              live={live}
              emptyLabel={
                live
                  ? "Aucun développeur n'a encore atteint le seuil ce mois-ci."
                  : "Aucun classement archivé pour cette période."
              }
            />
          </div>

          <RewardsLegend rewards={config?.rewards?.regional} scope="classement mondial" />
        </section>

        <section className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Classement par pays</h2>
            <p className="text-sm text-muted-foreground">
              {live ? "Mois en cours — données de missions en direct." : `${periodLabel} — classement archivé.`}
            </p>
          </div>

          <div className="mt-5 space-y-5">
            {countries.map((country, index) => {
              const meta = countryMeta.get(country.key);
              const rows = country.rows;
              return (
                <Reveal key={country.key} delay={(index % 3) as 0 | 1 | 2}>
                  <div className="overflow-hidden rounded-2xl border border-hairline bg-card">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline bg-surface px-4 py-3.5 sm:px-6">
                      <div className="flex items-center gap-2.5">
                        {meta ? <Flag countryCode={meta.code} size={20} /> : null}
                        <h3 className="text-sm font-semibold tracking-tight">{meta?.nameFr ?? country.key}</h3>
                        {meta ? <span className="badge badge-muted">{meta.currencyLabel}</span> : null}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {rows.length} développeur{rows.length > 1 ? "s" : ""} classé{rows.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    <LeaderboardTable
                      rows={rows}
                      live={live}
                      emptyLabel={`Aucune donnée pour ${meta?.nameFr ?? country.key} ce mois-ci.`}
                    />
                    <RewardsLegend rewards={config?.rewards?.country} scope={`classement ${meta?.nameFr ?? country.key}`} />
                  </div>
                </Reveal>
              );
            })}

            {countries.length === 0 && (
              <Reveal>
                <div className="rounded-2xl border border-hairline bg-card p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    Aucun classement par pays pour cette période.
                  </p>
                </div>
              </Reveal>
            )}
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Palmarès des mois précédents</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pastReads.filter(Boolean).length === 0 ? (
              <div className="sm:col-span-2 lg:col-span-3 rounded-2xl border border-hairline bg-card p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  L&apos;historique apparaîtra après le premier mois clos.
                </p>
              </div>
            ) : (
              pastReads
                .filter((p): p is LeaderboardPayload => Boolean(p))
                .map((p) => {
                  const tops = (p.regional ?? []).filter((r) => r.rank <= 3 && r.tokens_awarded > 0);
                  return (
                    <div
                      key={`${p.period?.year}-${p.period?.month}`}
                      className="rounded-2xl border border-hairline bg-card p-5"
                    >
                      <p className="text-sm font-semibold">
                        {p.period ? palmarèsLabel(p.period.year, p.period.month) : "Mois archivé"}
                        <span className="ml-2 rounded-full border border-success/40 bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">
                          clos
                        </span>
                      </p>
                      {tops.length === 0 ? (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Récompenses non attribuées ce mois-là.
                        </p>
                      ) : (
                        <ul className="mt-3 flex flex-col gap-2 text-sm">
                          {tops.map((row) => (
                            <li key={row.developer_id} className="flex items-center justify-between gap-2">
                              <span className="min-w-0 truncate">
                                <span className="mr-1.5 font-semibold text-primary">{row.rank}.</span>
                                {row.full_name ?? row.username ?? "Développeur"}
                              </span>
                              <span className="shrink-0 text-xs font-semibold text-success">
                                +{row.tokens_awarded}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })
            )}
          </div>
        </section>

        <section className="mt-14" aria-label="Critères clés du classement et du score">
          <div className="rounded-2xl border border-hairline bg-card p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight sm:text-xl">
                  <Trophy className="size-5 text-primary" aria-hidden="true" />
                  Boostez votre rang — Critères clés
                </h2>
                <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
                  Votre position au classement mensuel et votre score de réputation (sur 100) reposent uniquement sur des signaux vérifiables :
                </p>
              </div>
              <Link
                href="/dashboard?tab=profil"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-hairline bg-background/60 px-3.5 text-xs font-medium text-foreground transition-colors outline-none hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                Compléter mon profil
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>

            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  title: "Note moyenne des clients",
                  detail: "Jusqu’à 35 points dans le score de réputation.",
                },
                {
                  title: "Missions réalisées et confirmées",
                  detail: `${config?.points_per_project ?? POINTS_PER_PROJECT} pts par projet au classement mensuel, et jusqu’à 20 pts au score.`,
                },
                {
                  title: "Volume d’avis vérifiés",
                  detail: "Jusqu’à 15 points selon le nombre de retours clients.",
                },
                {
                  title: "Complétude du profil",
                  detail: "Photo, bio, ville, compétences et portfolio : jusqu’à 15 points.",
                },
                {
                  title: "Réactivité aux messages",
                  detail: "Jusqu’à 10 points selon votre taux et délai de réponse.",
                },
                {
                  title: "Profil vérifié",
                  detail: "+5 points de bonus après validation de votre identité.",
                },
              ].map((item) => (
                <li
                  key={item.title}
                  className="flex items-start gap-2.5 rounded-xl border border-hairline bg-surface p-3.5"
                >
                  <CheckCircle2
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {item.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <p className="mt-12 border-t border-hairline pt-6 text-xs leading-relaxed text-muted-foreground">
          Critère d&apos;apparition : au moins {config?.min_projects ?? 2} missions terminées et confirmées
          par mois. Chaque projet terminé vaut {config?.points_per_project ?? POINTS_PER_PROJECT} points. Au
          classement mondial, les 3 premiers reçoivent 10, 7 et 4 contacts bonus ; les classements par pays servent de
          référence et les badges restent conservés.
        </p>
      </Section>
    </div>
  );
}