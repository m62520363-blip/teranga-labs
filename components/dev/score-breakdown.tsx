"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "cn";

export type ScoreComponents = {
  reviews?: number | null;
  progress?: number | null;
  feedback?: number | null;
  profile?: number | null;
  responsiveness?: number | null;
  bonus?: number | null;
  penalty?: number | null;
};

type ScoreData = {
  score: number;
  level: string;
  components: ScoreComponents | null;
};

const SCORE_DETAILS: {
  key: keyof ScoreComponents;
  label: string;
  hint: string;
  max: number;
}[] = [
  { key: "reviews", label: "Note moyenne des clients", hint: "jusqu'à 35 points", max: 35 },
  { key: "progress", label: "Projets terminés", hint: "jusqu'à 20 points", max: 20 },
  { key: "feedback", label: "Volume d'avis", hint: "jusqu'à 15 points", max: 15 },
  { key: "profile", label: "Complétude du profil", hint: "jusqu'à 15 points", max: 15 },
  { key: "responsiveness", label: "Réactivité", hint: "jusqu'à 10 points", max: 10 },
  { key: "bonus", label: "Bonus profil vérifié", hint: "+5 points", max: 5 },
  { key: "penalty", label: "Pénalités de modération", hint: "retranchées du total", max: 5 },
];

export function ScoreBreakdown({ identifier }: { identifier: string }) {
  const [data, setData] = React.useState<ScoreData | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      if (!supabase) return;
      const { data: raw } = await supabase.rpc("get_developer_score", {
        p_identifier: identifier,
      });
      if (!cancelled && raw) {
        setData(raw as unknown as ScoreData);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [identifier]);

  return (
    <section className="mt-8 border-t border-hairline pt-6" aria-label="Score Devmarket">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Score Devmarket
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Indice de confiance calculé sur les avis, les projets terminés, la
            complétude du profil et la réactivité.
          </p>
        </div>
        {data ? (
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold tracking-tight text-primary">
              {data.score}/100
            </span>
            <span className="rounded-full border border-success/40 bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">
              {data.level}
            </span>
          </div>
        ) : null}
      </div>

      {data ? (
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {SCORE_DETAILS.map((detail) => {
            const value = data.components?.[detail.key] ?? 0;
            const pct = detail.max > 0 ? Math.min(100, Math.round((value / detail.max) * 100)) : 0;
            const negative = detail.key === "penalty" && value < 0;
            return (
              <div key={detail.key} className="flex items-center gap-3 rounded-xl border border-hairline bg-surface px-3 py-2">
                <span className="w-6 shrink-0 text-right text-sm font-semibold tabular-nums">
                  {value}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13px] font-medium">{detail.label}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{detail.hint}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border-strong">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        negative ? "bg-error" : "bg-primary"
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Calcul en cours…</p>
      )}
    </section>
  );
}