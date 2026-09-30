"use client";

import type { ReactNode } from "react";
import { AnimatedCounter } from "@/components/animated-counter";
import { formatFCFA } from "@/lib/formatting";
import { STATS_PLACEHOLDER_LEGEND } from "@/components/landing/content";

type Stats = {
  count: number;
  cities: number;
  avgBudget: number;
};

export function StatsSection({ stats }: { stats: Stats | null }) {
  return (
    <section className="tl-dark relative overflow-hidden py-20 md:py-24" aria-label="Statistiques">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(42rem 24rem at 15% 0%, rgba(232,106,44,0.28), transparent 62%), radial-gradient(36rem 22rem at 90% 100%, rgba(232,106,44,0.14), transparent 60%)",
        }}
      />
      <div className="container-tl relative">
        <div className="grid grid-cols-2 gap-10 text-center lg:grid-cols-4">
          <Tile
            value={
              stats ? (
                <AnimatedCounter value={stats.count} />
              ) : (
                <span className="font-display text-5xl">—</span>
              )
            }
            label="Demandes en ligne"
            live={Boolean(stats)}
          />
          <Tile
            value={
              stats ? (
                <AnimatedCounter value={stats.cities} />
              ) : (
                <span className="font-display text-5xl">—</span>
              )
            }
            label="Régions couvertes"
            live={Boolean(stats)}
          />
          <Tile
            value={
              stats ? (
                <AnimatedCounter value={stats.avgBudget} format={formatFCFA} />
              ) : (
                <span className="font-display text-5xl">—</span>
              )
            }
            label="Budget moyen"
            live={Boolean(stats)}
          />
          <Tile value={<span className="font-display text-5xl font-bold">24/7</span>} label="Accessible" />
        </div>

        {!stats && (
          <p className="mx-auto mt-12 max-w-md text-center text-sm text-white/50">
            {STATS_PLACEHOLDER_LEGEND}
          </p>
        )}
      </div>
    </section>
  );
}

function Tile({
  value,
  label,
  live,
}: {
  value: ReactNode;
  label: string;
  live?: boolean;
}) {
  return (
    <div className="relative">
      {live && (
        <span className="absolute left-1/2 top-[-8px] -translate-x-1/2 rounded-full bg-white/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-white/60">
          En direct
        </span>
      )}
      <p className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
        {value}
      </p>
      <p className="mt-2 text-sm text-white/60">{label}</p>
    </div>
  );
}