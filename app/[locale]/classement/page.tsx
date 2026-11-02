import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Award, Crown, Trophy, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Section, SectionHeader } from "@/components/landing/section";
import { Reveal } from "@/components/reveal";
import { cn } from "cn";

export const metadata: Metadata = {
  title: "Classement mondial des développeurs",
  description:
    "Classement mondial des développeurs sur Devmarket, du premier jusqu'au dernier. Le premier reçoit le plus de récompenses.",
};

export const dynamic = "force-dynamic";

type LeaderboardDeveloper = {
  rank: number;
  developer_id: string;
  username: string | null;
  full_name: string | null;
  city: string | null;
  avatar_url: string | null;
  completed_projects: number;
  points: number;
};

const HEADERS = [
  "Rang",
  "Développeur",
  "Missions terminées",
  "Points",
  "Récompenses",
];

const POINTS_PER_PROJECT = 50;

function initialsOf(name: string | null): string {
  if (!name) return "D";
  const parts = name.split(/\s+/).filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase() ?? "")
      .join("") || "D"
  );
}

function ordinalLabel(rank: number): string {
  return rank === 1 ? "1er" : `${rank}e`;
}

function DeveloperCell({ row }: { row: LeaderboardDeveloper }) {
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
          <span className="block truncate text-xs text-muted-foreground">
            {row.city}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function RewardBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning">
        <Crown className="size-3.5" aria-hidden="true" />
        1er — Plus de récompenses
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
        <Trophy className="size-3.5" aria-hidden="true" />
        2e — Récompenses bonus
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-muted px-2.5 py-1 text-xs font-semibold text-foreground">
        <Award className="size-3.5" aria-hidden="true" />
        3e — Récompenses bonus
      </span>
    );
  }
  return (
    <span className="text-xs font-medium text-muted-foreground">
      {ordinalLabel(rank)} du classement
    </span>
  );
}

export default async function ClassementPage() {
  const supabase = await createClient();

  const rows: LeaderboardDeveloper[] = [];

  if (supabase) {
    const [leaderboardRes, devsRes] = await Promise.all([
      supabase.rpc("get_leaderboard", {}),
      supabase.rpc("list_approved_developers", {
        p_limit: 500,
        p_offset: 0,
      }),
    ]);

    const seen = new Set<string>();
    const payload = (leaderboardRes.data ?? null) as {
      regional?: Array<{
        developer_id: string;
        username?: string | null;
        full_name?: string | null;
        city?: string | null;
        avatar_url?: string | null;
        completed_projects?: number;
        points?: number;
      }>;
    } | null;

    const rawDevs: Array<{
      developer_id: string;
      username: string | null;
      full_name: string | null;
      city: string | null;
      avatar_url: string | null;
      completed_projects: number;
      points: number;
    }> = [];

    for (const r of payload?.regional ?? []) {
      if (!r.developer_id || seen.has(r.developer_id)) continue;
      seen.add(r.developer_id);
      const completed = r.completed_projects ?? 0;
      rawDevs.push({
        developer_id: r.developer_id,
        username: r.username ?? null,
        full_name: r.full_name ?? null,
        city: r.city ?? null,
        avatar_url: r.avatar_url ?? null,
        completed_projects: completed,
        points: r.points ?? completed * POINTS_PER_PROJECT,
      });
    }

    const approvedList = Array.isArray(devsRes.data)
      ? (devsRes.data as Array<{
          id?: string;
          username?: string | null;
          full_name?: string | null;
          city?: string | null;
          avatar_url?: string | null;
          completed_projects_count?: number | null;
          reputation_score?: number | null;
        }>)
      : [];

    for (const d of approvedList) {
      if (!d.id || seen.has(d.id)) continue;
      seen.add(d.id);
      const completed = d.completed_projects_count ?? 0;
      rawDevs.push({
        developer_id: d.id,
        username: d.username ?? null,
        full_name: d.full_name ?? null,
        city: d.city ?? null,
        avatar_url: d.avatar_url ?? null,
        completed_projects: completed,
        points:
          completed * POINTS_PER_PROJECT + (d.reputation_score ?? 0),
      });
    }

    rawDevs.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.completed_projects - a.completed_projects;
    });

    rawDevs.forEach((item, index) => {
      rows.push({
        ...item,
        rank: index + 1,
      });
    });
  }

  return (
    <div className="bg-background">
      <Section ariaLabel="Classement mondial des développeurs">
        <div className="max-w-3xl">
          <SectionHeader
            align="left"
            eyebrow="Classement mondial"
            title="Le classement des développeurs"
            lead="Découvrez le classement mondial de tous les développeurs de la plateforme, du 1er jusqu'au dernier. Le premier du classement obtient le plus de récompenses et de visibilité."
          />
        </div>

        <Reveal className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hairline bg-card px-5 py-4">
            <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Crown className="size-4 text-warning" aria-hidden="true" />
              Le <strong className="text-foreground">1er</strong> du classement mondial reçoit le plus de récompenses, suivi du <strong className="text-foreground">2e</strong> et du <strong className="text-foreground">3e</strong>.
            </p>
            <Link
              href="/dashboard?tab=profil"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-hairline bg-background/60 px-3.5 text-xs font-medium text-foreground transition-colors outline-none hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              Mon profil
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        </Reveal>

        <section className="mt-8">
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
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center sm:px-6">
                        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                          <UserRound
                            className="size-4 text-primary"
                            aria-hidden="true"
                          />
                          Aucun développeur classé pour le moment.
                        </span>
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr
                        key={row.developer_id}
                        className={cn(row.rank <= 3 && "bg-primary-soft/30")}
                      >
                        <td className="px-4 py-3 sm:px-6">
                          <span
                            className={cn(
                              "inline-flex min-w-8 items-center justify-center rounded-full px-2 py-1 text-xs font-bold",
                              row.rank === 1
                                ? "bg-warning/20 text-warning"
                                : row.rank === 2
                                  ? "bg-primary-soft text-primary"
                                  : row.rank === 3
                                    ? "bg-muted text-foreground"
                                    : "bg-surface text-muted-foreground"
                            )}
                          >
                            {ordinalLabel(row.rank)}
                          </span>
                        </td>
                        <td className="px-4 py-3 sm:px-6">
                          <DeveloperCell row={row} />
                        </td>
                        <td className="px-4 py-3 font-semibold sm:px-6">
                          {row.completed_projects}
                        </td>
                        <td className="px-4 py-3 font-semibold text-primary sm:px-6">
                          {row.points}
                        </td>
                        <td className="px-4 py-3 sm:px-6">
                          <RewardBadge rank={row.rank} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </Section>
    </div>
  );
}
