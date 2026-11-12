"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  ClipboardList,
  MapPin,
  UserRound,
} from "lucide-react";
import { formatFCFA, formatDate, formatDateTime } from "@/lib/formatting";
import { MISSION_STATUS_LABELS } from "@/lib/mission-labels";
import type { MissionStatus } from "@/types/database";
import { StatusBadge } from "@/components/missions/status-badge";
import { DeveloperReviewForm } from "@/components/missions/developer-review-form";
import { MissionPayButton } from "@/components/missions/mission-pay-button";
import type { MissionPayload } from "@/components/missions/types";
import { cn } from "cn";

function opponentName(opponent: MissionPayload["opponent"]): string {
  if (!opponent) return "—";
  if (opponent.related_as === "developer") {
    return opponent.full_name || opponent.username || "Développeur";
  }
  return opponent.company_name || opponent.contact_name || "Client";
}

export function MissionDetail({
  mission,
  userId,
  role,
  justPaid = false,
}: {
  mission: MissionPayload;
  userId: string;
  role: string | null;
  justPaid?: boolean;
}) {
  return (
    <div className="bg-surface">
      <div className="container-tl py-8 md:py-12">
        <Link
          href="/missions"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Toutes mes missions
        </Link>

        <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              <ClipboardList className="size-3.5" aria-hidden="true" />
              Détail de la mission
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              {mission.request?.project_type || "Mission"}
            </h1>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              Créée le {mission.created_at ? formatDate(mission.created_at) : "—"}
            </p>
          </div>
          <StatusBadge status={mission.status} />
        </div>

        {justPaid && mission.status === "awaiting_payment" ? (
          <div className="mt-6 rounded-xl border border-success/40 bg-success-soft px-4 py-3 text-sm">
            Paiement lancé : la confirmation automatique arrive en quelques secondes. Rechargez la
            page si le statut ne se met pas à jour.
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-hairline bg-card p-5 shadow-sm lg:col-span-2">
            <div className="grid grid-cols-3 gap-3 rounded-xl border border-hairline bg-surface p-3 text-sm">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Montant
                </p>
                <p className="mt-0.5 font-semibold text-primary">
                  {formatFCFA(mission.agreed_price_fcfa)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Délai</p>
                <p className="mt-0.5 font-semibold">{mission.agreed_days} j</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Début</p>
                <p className="mt-0.5 font-semibold">
                  {mission.started_at ? formatDate(mission.started_at) : "—"}
                </p>
              </div>
            </div>

            <p className="mt-4 text-[11px] uppercase tracking-wide text-muted-foreground">
              Description
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {mission.description || "Aucune description fournie."}
            </p>

            <div className="mt-4 flex items-center gap-3 rounded-xl border border-hairline bg-surface px-3 py-2.5">
              {mission.opponent && mission.opponent.related_as === "developer" &&
              mission.opponent.avatar_url ? (
                <Image
                  src={mission.opponent.avatar_url}
                  alt=""
                  width={36}
                  height={36}
                  unoptimized
                  className="size-9 shrink-0 rounded-lg border border-hairline object-cover"
                />
              ) : (
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  {mission.opponent?.related_as === "client" ? (
                    <Building2 className="size-4" aria-hidden="true" />
                  ) : (
                    <UserRound className="size-4" aria-hidden="true" />
                  )}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{opponentName(mission.opponent)}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  {mission.opponent?.related_as === "client" ? "Client" : "Développeur"}
                  {mission.opponent?.city ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <MapPin className="size-3" aria-hidden="true" />
                      {mission.opponent.city}
                    </>
                  ) : null}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {role === "client" && mission.status === "awaiting_payment" ? (
                <MissionPayButton
                  missionId={mission.id}
                  amountFcfa={mission.agreed_price_fcfa}
                  size="default"
                />
              ) : null}
              {role === "client" && mission.status === "awaiting_payment" ? (
                <p className="text-xs text-muted-foreground">
                  Le paiement débloque le démarrage de la mission.
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-hairline bg-card p-5 shadow-sm">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Informations
            </p>
            <dl className="mt-3 flex flex-col gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Statut</dt>
                <dd className="mt-0.5 font-medium">
                  {MISSION_STATUS_LABELS[mission.status as MissionStatus]?.label ??
                    mission.status}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Budget client</dt>
                <dd className="mt-0.5 font-medium">
                  {mission.request?.budget ? formatFCFA(mission.request.budget) : "—"}
                </dd>
              </div>

              <div>
                <dt className="text-xs text-muted-foreground">Livraison prévue</dt>
                <dd className="mt-0.5 font-medium">
                  {mission.completed_at
                    ? formatDate(mission.completed_at)
                    : `Dès ${mission.agreed_days} jours après le démarrage`}
                </dd>
              </div>
            </dl>

            {role === "developer" && mission.status === "completed" ? (
              <div className="mt-6">
                <DeveloperReviewForm requestId={mission.request_id} />
              </div>
            ) : null}

            <p className="mt-6 text-[11px] uppercase tracking-wide text-muted-foreground">
              Historique
            </p>
            {mission.events.length > 0 ? (
              <ol className="mt-3 flex flex-col gap-3 border-t border-hairline pt-3">
                {mission.events.map((e) => (
                  <li key={e.id} className="flex flex-col gap-0.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">
                        {e.actor_id === userId ? "Vous" : "Partie adverse"} ·{" "}
                        {e.status_from ? (
                          <>
                            {MISSION_STATUS_LABELS[e.status_from as MissionStatus]?.short ??
                              e.status_from}{" "}
                            →{" "}
                          </>
                        ) : null}
                        {MISSION_STATUS_LABELS[e.status_to as MissionStatus]?.short ??
                          e.status_to}
                      </span>
                      <span className="text-muted-foreground">
                        {formatDateTime(e.created_at)}
                      </span>
                    </div>
                    {e.comment ? (
                      <p className="text-muted-foreground">{e.comment}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className={cn("mt-3 text-xs text-muted-foreground")}>
                Aucune étape enregistrée pour le moment.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
