"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatFCFA } from "@/lib/formatting";

type MatchRow = {
  developer_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  country: string | null;
  main_specialty: string | null;
  rate_min_fcfa: number | null;
  is_verified: boolean;
  reputation_score: number;
  reputation_level: string | null;
  score: number;
  components: {
    type?: number;
    location?: number;
    budget?: number;
    reputation?: number;
    availability?: number;
  };
};

export function DevmarketMatch({
  projectType,
  city,
  budget,
}: {
  projectType: string;
  city?: string | null;
  budget: number;
}) {
  const [rows, setRows] = React.useState<MatchRow[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      if (!supabase) return;
      const { data } = await supabase.rpc("teranga_match", {
        p_project_type: projectType,
        p_city: city ?? "",
        p_budget: budget,
        p_limit: 6,
      });
      if (!cancelled && Array.isArray(data)) {
        setRows(data as unknown as MatchRow[]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectType, city, budget]);

  if (rows.length === 0) return null;

  return (
    <section aria-label="Développeurs recommandés" className="mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">
          Développeurs recommandés
        </h2>
        <span className="text-xs text-muted-foreground">
          Score de compatibilité Devmarket Match
        </span>
      </div>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => {
          const name = row.full_name ?? row.username ?? "Développeur";
          return (
            <li key={row.developer_id}>
              <Link
                href={`/dev/${encodeURIComponent(row.username ?? "")}`}
                className="group flex h-full items-center gap-3 rounded-2xl border border-hairline bg-card p-3 transition-colors hover:border-primary/40"
              >
                <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-hairline">
                  {row.avatar_url ? (
                    <Image
                      src={row.avatar_url}
                      alt=""
                      width={44}
                      height={44}
                      unoptimized
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="text-base font-bold text-primary">
                      {name.trim().slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                    {name}
                    {row.is_verified ? (
                      <span className="rounded-full bg-success-soft px-1.5 py-0.5 text-[9px] font-bold uppercase text-success">
                        Vérifié
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                    {row.city ? (
                      <>
                        <MapPin className="size-3 shrink-0" aria-hidden="true" />
                        {row.city}
                      </>
                    ) : null}
                    {row.rate_min_fcfa ? (
                      <span className="shrink-0">
                        · dès {formatFCFA(row.rate_min_fcfa)}
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-lg font-bold tabular-nums text-primary">
                    {row.score}
                  </span>
                  <span className="text-xs text-muted-foreground">/100</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}