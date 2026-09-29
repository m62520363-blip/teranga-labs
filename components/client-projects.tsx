"use client";

import * as React from "react";
import Link from "next/link";
import {
  Archive,
  Calendar,
  Check,
  Inbox,
  Loader2,
  MessageCircle,
  Sparkles,
  Star,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatFCFA, formatDate } from "@/lib/formatting";
import { cn } from "cn";

export type ClientProjectItem = {
  id: string;
  client_name: string;
  client_city: string;
  project_type: string;
  budget: number;
  description: string;
  status: string;
  features: string[];
  deadline: string | null;
  max_unlocks: number;
  current_unlocks_count: number;
  candidates: number;
  pendingOffers: number;
  firstConvId: string | null;
  awardedConvId: string | null;
  awardedName: string | null;
  archived: boolean;
  convIdToArchive: string | null;
  lastActiveAt: string | null;
  daysLeft: number | null;
  review: { id: string; rating: number } | null;
};

const PHASES: Record<
  string,
  { label: string; step: number }
> = {
  ouvert: { label: "En recherche de développeurs", step: 1 },
  attribué: { label: "Développeur choisi — mission en cours", step: 2 },
  terminé: { label: "Mission terminée", step: 3 },
};

export function ClientProjects({ items }: { items: ClientProjectItem[] }) {
  const [filter, setFilter] = React.useState<"all" | "archived">("all");
  const [archiving, setArchiving] = React.useState<string | null>(null);
  const [archivedIds, setArchivedIds] = React.useState<Set<string>>(
    () => new Set(items.filter((i) => i.archived).map((i) => i.id))
  );

  const active = items.filter((i) => !archivedIds.has(i.id));
  const archivedList = items.filter((i) => archivedIds.has(i.id));
  const shown = filter === "all" ? active : archivedList;

  const archiveProject = async (item: ClientProjectItem) => {
    const convId = item.convIdToArchive;
    if (!convId) return;
    setArchiving(item.id);
    const supabase = createClient();
    const { error } = await supabase.rpc("client_archive_conversation", {
      p_conversation_id: convId,
    });
    setArchiving(null);
    if (error) return;
    setArchivedIds((prev) => new Set(prev).add(item.id));
  };

  const tabs: { key: "all" | "archived"; label: string; count: number }[] = [
    { key: "all", label: "Projets", count: active.length },
    { key: "archived", label: "Archivés", count: archivedList.length },
  ];

  return (
    <div>
      {items.length > 0 ? (
        <div className="mt-5 flex flex-wrap items-center gap-1.5">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilter(t.key)}
              aria-pressed={filter === t.key}
              className={cn(
                "inline-flex h-8 items-center rounded-lg border px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                filter === t.key
                  ? "border-primary/60 bg-[#2A1A10] text-[#F2A378]"
                  : "border-hairline bg-transparent text-muted-foreground hover:bg-[#1E1E1E]"
              )}
            >
              {t.label}
              <span className="ml-1.5 text-muted-foreground">{t.count}</span>
            </button>
          ))}
        </div>
      ) : null}

      {shown.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          {filter === "archived"
            ? "Aucun projet archivé."
            : "Aucun projet dans cette catégorie."}
        </p>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {shown.map((r) => {
            const phase = PHASES[r.status] ?? PHASES.ouvert;
            return (
              <div
                key={r.id}
                className={cn(
                  "flex flex-col gap-4 rounded-2xl border p-5",
                  filter === "archived"
                    ? "border-hairline/60 bg-[#101010]"
                    : "border-hairline bg-[#141414]"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{r.client_name}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {r.client_city} · {r.project_type} · {formatFCFA(r.budget)}
                    </p>
                  </div>
                  <RequestStatusBadge status={r.status} />
                </div>

                {filter === "archived" ? (
                  <span className="badge badge-muted">Archivé par vos soins</span>
                ) : (
                  <PhaseIndicator phase={phase} />
                )}

                <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                  {r.description}
                </p>

                {(r.features.length > 0 || r.deadline) ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {r.features.slice(0, 4).map((f) => (
                      <span
                        key={f}
                        className="inline-flex items-center gap-1 rounded-full bg-[#122A1C] px-2.5 py-1 text-xs text-[#3DD68C]"
                      >
                        <Sparkles className="size-3" aria-hidden="true" />
                        {f}
                      </span>
                    ))}
                    {r.features.length > 4 ? (
                      <span className="text-xs text-muted-foreground">
                        +{r.features.length - 4} autres
                      </span>
                    ) : null}
                    {r.deadline ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs",
                          (r.daysLeft ?? 0) < 0
                            ? "bg-[#3B1A1A] text-[#F87171]"
                            : (r.daysLeft ?? 0) <= 7
                              ? "bg-[#2A1A10] text-primary"
                              : "bg-[#1A1A2E] text-muted-foreground"
                        )}
                      >
                        <Calendar className="size-3" aria-hidden="true" />
                        {formatDate(r.deadline)}
                        {r.daysLeft != null ? (
                          <span className="opacity-80">
                            {r.daysLeft < 0
                              ? "· échéance passée"
                              : r.daysLeft === 0
                                ? "· aujourd’hui"
                                : `· J-${r.daysLeft}`}
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {r.awardedConvId && r.awardedName ? (
                  <div className="flex items-center gap-2 rounded-xl border border-[#166534]/60 bg-[#0F2E18] px-3 py-2.5 text-sm">
                    <Check className="size-4 shrink-0 text-[#4ADE80]" aria-hidden="true" />
                    <span className="text-muted-foreground">
                      Développeur retenu :{" "}
                      <span className="font-medium text-foreground">{r.awardedName}</span>
                    </span>
                    <Link
                      href={`/conversations/${r.awardedConvId}`}
                      className="ml-auto shrink-0 text-xs font-medium text-[#4ADE80] underline-offset-4 hover:underline"
                    >
                      Ouvrir la discussion
                    </Link>
                  </div>
                ) : null}

                {r.status === "terminé" ? (
                  <div
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-3.5 sm:items-center",
                      r.review
                        ? "border-hairline bg-[#101010]"
                        : "border-primary/30 bg-[#1A120B]"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg",
                        r.review ? "bg-[#F5C26B]/15 text-[#F5C26B]" : "bg-primary text-ink"
                      )}
                    >
                      <Star className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      {r.review ? (
                        <p className="text-sm">
                          <span className="font-medium">
                            Votre avis : {r.review.rating}/5
                          </span>{" "}
                          <span className="text-muted-foreground">
                            publié pour cette mission.
                          </span>
                        </p>
                      ) : (
                        <p className="text-sm">
                          La mission est terminée : votre note et votre avis
                          aideront les futurs clients.
                        </p>
                      )}
                    </div>
                    <Link
                      href={`/review/${r.id}`}
                      className={cn(
                        "shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                        r.review
                          ? "border border-hairline text-foreground hover:bg-[#1E1E1E]"
                          : "bg-foreground text-ink hover:bg-[#EBEBEB]"
                      )}
                    >
                      {r.review ? "Modifier l’avis" : "Évaluer la mission"}
                    </Link>
                  </div>
                ) : null}

                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Inbox className="size-3.5" aria-hidden="true" />
                      {r.candidates} développeur{r.candidates > 1 ? "s" : ""}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Wallet className="size-3.5" aria-hidden="true" />
                      {r.current_unlocks_count}/{r.max_unlocks} déblocages
                    </span>
                  </div>
                  {r.pendingOffers > 0 ? (
                    <Link
                      href={r.firstConvId ? `/conversations/${r.firstConvId}` : "/client"}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-[#f59348]"
                    >
                      <Sparkles className="size-3.5" aria-hidden="true" />
                      {r.pendingOffers} devis à examiner
                    </Link>
                  ) : r.firstConvId ? (
                    <Link
                      href={`/conversations/${r.firstConvId}`}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      <MessageCircle className="size-3.5" aria-hidden="true" />
                      Voir la discussion
                    </Link>
                  ) : null}
                </div>

                {filter === "all" && r.convIdToArchive ? (
                  <button
                    type="button"
                    onClick={() => archiveProject(r)}
                    disabled={archiving === r.id}
                    className="inline-flex h-8 items-center gap-1.5 self-start rounded-lg border border-hairline px-2.5 text-xs font-medium text-muted-foreground transition-colors outline-none hover:border-[#F87171]/40 hover:text-[#F87171] focus-visible:ring-2 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-50"
                  >
                    {archiving === r.id ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Archive className="size-3.5" aria-hidden="true" />
                    )}
                    Archiver ce projet
                  </button>
                ) : null}

                <p className="text-xs text-muted-foreground">
                  {r.lastActiveAt
                    ? `Dernière activité le ${formatDate(r.lastActiveAt)}`
                    : "Aucune activité pour le moment"}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PhaseIndicator({
  phase,
}: {
  phase: { label: string; step: number };
}) {
  const steps = [1, 2, 3];
  return (
    <div className="flex items-center gap-2">
      {steps.map((n) => (
        <span
          key={n}
          className={cn(
            "h-1 flex-1 rounded-full",
            n <= phase.step
              ? phase.step === 3
                ? "bg-[#4ADE80]"
                : "bg-primary"
              : "bg-hairline"
          )}
          aria-hidden="true"
        />
      ))}
      <span className="text-xs text-muted-foreground">{phase.label}</span>
    </div>
  );
}

function RequestStatusBadge({ status }: { status: string }) {
  if (status === "ouvert") {
    return <span className="badge badge-success">En recherche</span>;
  }
  if (status === "attribué") {
    return <span className="badge badge-warning">Attribué</span>;
  }
  if (status === "terminé") {
    return <span className="badge badge-muted">Terminé</span>;
  }
  return <span className="badge badge-muted">{status}</span>;
}