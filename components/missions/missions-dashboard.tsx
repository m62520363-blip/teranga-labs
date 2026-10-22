"use client";

import * as React from "react";
import { toast } from "sonner";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  History,
  Loader2,
  MapPin,
  Scale,
  Search,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatFCFA, formatDate, formatDateTime } from "@/lib/formatting";
import {
  MISSION_STATUS_LABELS,
  MISSION_TRANSITIONS,
  missionErrorMessage,
} from "@/lib/mission-labels";
import type { MissionStatus } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/missions/status-badge";
import { MissionPayButton } from "@/components/missions/mission-pay-button";
import type { MissionEventPayload, MissionPayload } from "@/components/missions/types";
import { cn } from "cn";

export type { MissionEventPayload, MissionPayload };

/** Ligne renvoyée par la RPC list_my_disputes (F2). */
export type DisputeRow = {
  id: string;
  mission_id: string;
  reason: string;
  status: "open" | "under_review" | "resolved" | "rejected";
  resolution: string | null;
  created_at: string;
  resolved_at: string | null;
  i_am_complainant: boolean;
};

const DISPUTE_STATUS_LABELS: Record<DisputeRow["status"], string> = {
  open: "Ouvert",
  under_review: "En cours d'examen",
  resolved: "Résolu",
  rejected: "Rejeté",
};

const DISPUTE_STATUS_CLASS: Record<DisputeRow["status"], string> = {
  open: "bg-error-soft text-error",
  under_review: "bg-muted text-foreground",
  resolved: "bg-success-soft text-success",
  rejected: "bg-muted text-muted-foreground",
};

type Props = {
  missions: MissionPayload[];
  userId: string;
  role: string | null;
  focusId?: string | null;
  disputes?: DisputeRow[];
};

type FilterKey = "all" | "active" | "completed" | "disputed" | "cancelled";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "active", label: "En cours" },
  { key: "completed", label: "Terminées" },
  { key: "disputed", label: "Litiges" },
  { key: "cancelled", label: "Annulées" },
];

function opponentName(opponent: MissionPayload["opponent"]): string {
  if (!opponent) return "—";
  if (opponent.related_as === "developer") {
    return opponent.full_name || opponent.username || "Développeur";
  }
  return opponent.company_name || opponent.contact_name || "Client";
}

export function MissionsDashboard({ missions, userId, role, focusId = null, disputes = [] }: Props) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<FilterKey>("all");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState<{
    mission: MissionPayload;
    transition: { to: MissionStatus; label: string; confirm?: boolean; comment?: boolean };
  } | null>(null);
  const [comment, setComment] = React.useState("");
  const [openHistory, setOpenHistory] = React.useState<Record<string, boolean>>({});
  const cardRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  React.useEffect(() => {
    if (focusId && cardRefs.current[focusId]) {
      cardRefs.current[focusId]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusId]);

  const isDeveloper = role === "developer";
  const roleKey: "developer" | "client" = isDeveloper ? "developer" : "client";
  const canAct = role === "developer" || role === "client";

  const updateStatus = async (mission: MissionPayload, to: MissionStatus, pComment?: string) => {
    setBusyId(mission.id);
    const supabase = createClient();

    // F2 : ouvrir le litige dans la TABLE disputes (modération admin), pas
    // seulement le statut de mission. Le motif = commentaire saisi (10 car.
    // min exigés par la RPC). TLDUP = un litige existe déjà : on laisse
    // mission_update_status suivre son cours.
    if (to === "dispute_open" || to === "disputed") {
      const { error: disputeError } = await supabase.rpc("open_dispute", {
        p_mission_id: mission.id,
        p_reason: (pComment ?? "").trim(),
      });
      if (disputeError && disputeError.code !== "TLDUP") {
        setBusyId(null);
        toast.error(
          missionErrorMessage(disputeError.code ?? null, disputeError.message || "Impossible d'ouvrir le litige."),
        );
        return;
      }
    }

    const { data, error } = await supabase.rpc("mission_update_status", {
      p_mission_id: mission.id,
      p_to_status: to,
      p_comment: pComment?.trim() || undefined,
    });
    setBusyId(null);
    if (error) {
      toast.error(missionErrorMessage(error.code ?? null, error.message || "Action impossible."));
      return;
    }
    const res = (data ?? null) as { status: MissionStatus } | null;
    if (res) {
      setMissionsLocal((prev) =>
        prev.map((m) => (m.id === mission.id ? { ...m, status: res.status } : m)),
      );
    }
    toast.success("Statut de la mission mis à jour.");
    router.refresh();
  };

  const [missionsLocal, setMissionsLocal] = React.useState<MissionPayload[]>(missions);

  const visible = missionsLocal.filter((m) => {
    if (filter === "all") return true;
    if (filter === "active") return m.status === "new" || m.status === "in_progress";
    return m.status === filter;
  });

  const act = (mission: MissionPayload, to: MissionStatus) => {
    const transitions = MISSION_TRANSITIONS[mission.status].filter((t) => t.to === to);
    const transition = transitions.find((t) => t.by === roleKey || t.by === "either") ?? transitions[0];
    if (!transition) return;
    if (transition.confirm || transition.comment) {
      setComment("");
      setConfirm({ mission, transition });
    } else {
      void updateStatus(mission, to);
    }
  };

  return (
    <div className="bg-surface">
      <div className="container-tl py-8 md:py-12">
        {disputes.length > 0 ? (
          <section aria-label="Mes litiges" className="mb-8 rounded-2xl border border-error/25 bg-card p-5">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <Scale className="size-4 text-error" aria-hidden="true" />
              Mes litiges ({disputes.length})
            </h2>
            <ul className="mt-4 flex flex-col gap-3">
              {disputes.map((d) => (
                <li key={d.id} className="rounded-xl border border-hairline bg-surface p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-xs">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${DISPUTE_STATUS_CLASS[d.status]}`}
                      >
                        {DISPUTE_STATUS_LABELS[d.status]}
                      </span>
                      <span className="text-muted-foreground">
                        {d.i_am_complainant ? "Vous êtes demandeur" : "Vous êtes défendeur"}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDate(d.created_at)}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{d.reason}</p>
                  {d.resolution ? (
                    <p className="mt-2 text-xs text-muted-foreground">Résolution : {d.resolution}</p>
                  ) : null}
                  <Link
                    href={`/missions/${d.mission_id}`}
                    className="mt-3 inline-flex text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    Voir la mission →
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {visible.length === 0 ? null : (
          <>
            <div className="flex flex-col gap-2">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                <ClipboardList className="size-3.5" aria-hidden="true" />
                Suivi de projet
              </p>
              <h1 className="text-2xl font-semibold tracking-tight">Mes missions</h1>
              <p className="max-w-xl text-sm text-muted-foreground">
                {isDeveloper
                  ? "Les missions réelles issues de vos offres acceptées : suivez leur statut, démarrez-les et archivez chaque étape avec le client."
                  : "Suis l’avancée des projets que tu confies : statut, jalons et livraison au même endroit."}
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "rounded-xl border px-3.5 py-1.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    filter === f.key
                      ? "border-primary/40 bg-primary text-white"
                      : "border-hairline bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </>
        )}

        {visible.length === 0 ? (
          <div className="mx-auto flex max-w-3xl flex-col items-center rounded-2xl border border-hairline bg-card px-6 py-12 text-center">
            <ClipboardList className="size-7 text-muted-foreground" aria-hidden="true" />
            <p className="mt-4 text-base font-semibold tracking-tight">
              {isDeveloper ? "Aucune mission pour le moment" : "Aucun projet pour le moment"}
            </p>
            <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {isDeveloper
                ? "Les missions démarrent quand un client accepte une de tes propositions dans la messagerie."
                : "Parcours le catalogue, discute avec un développeur, puis confie-lui ton premier projet. Ton paiement reste bloqué jusqu’à ce que tu valides la livraison."}
            </p>
            <Link
              href={isDeveloper ? "/briefs" : "/dev"}
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground outline-none transition-colors hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <Search className="size-4" aria-hidden="true" />
              {isDeveloper ? "Voir les briefs" : "Parcourir le catalogue"}
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {visible.map((m) => {
              const isFocused = focusId !== null && m.id === focusId;
              const transitions = canAct
                ? MISSION_TRANSITIONS[m.status].filter((t) => t.by === roleKey || t.by === "either")
                : [];
              const showHistory = Boolean(openHistory[m.id]);
              return (
                <div
                  key={m.id}
                  ref={(el) => {
                    cardRefs.current[m.id] = el;
                  }}
                  className={cn(
                    "rounded-2xl border bg-card p-5 shadow-sm transition-shadow",
                    isFocused ? "border-primary/60 ring-2 ring-primary/30" : "border-hairline",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/missions/${m.id}`}
                        className="group inline-flex max-w-full items-center gap-1 text-sm font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <span className="truncate group-hover:text-primary">
                          {m.request?.project_type || "Mission"}
                        </span>
                        <ChevronRight
                          className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                          aria-hidden="true"
                        />
                      </Link>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarDays className="size-3.5" aria-hidden="true" />
                        Créée le {m.created_at ? formatDate(m.created_at) : "—"}
                      </p>
                    </div>
                    <StatusBadge status={m.status} />
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3 rounded-xl border border-hairline bg-surface p-3 text-sm">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Montant
                      </p>
                      <p className="mt-0.5 font-semibold text-primary">
                        {formatFCFA(m.agreed_price_fcfa)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Délai
                      </p>
                      <p className="mt-0.5 font-semibold">
                        {m.agreed_days} j
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Début
                      </p>
                      <p className="mt-0.5 font-semibold">
                        {m.started_at ? formatDate(m.started_at) : "—"}
                      </p>
                    </div>
                  </div>

                  {m.description ? (
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {m.description}
                    </p>
                  ) : null}

                  <div className="mt-4 flex items-center gap-3 rounded-xl border border-hairline bg-surface px-3 py-2.5">
                    {m.opponent && m.opponent.related_as === "developer" &&
                    m.opponent.avatar_url ? (
                      <Image
                        src={m.opponent.avatar_url}
                        alt=""
                        width={36}
                        height={36}
                        unoptimized
                        className="size-9 shrink-0 rounded-lg border border-hairline object-cover"
                      />
                    ) : (
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                        {m.opponent?.related_as === "client" ? (
                          <Building2 className="size-4" aria-hidden="true" />
                        ) : (
                          <UserRound className="size-4" aria-hidden="true" />
                        )}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{opponentName(m.opponent)}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        {m.opponent?.related_as === "client" ? "Client" : "Développeur"}
                        {m.opponent?.city ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <MapPin className="size-3" aria-hidden="true" />
                            {m.opponent.city}
                          </>
                        ) : null}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {role === "client" && m.status === "awaiting_payment" ? (
                      <MissionPayButton missionId={m.id} amountFcfa={m.agreed_price_fcfa} />
                    ) : null}
                    <Link
                      href={`/missions/${m.id}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 text-xs text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <ClipboardList className="size-3.5" aria-hidden="true" />
                      Détail
                    </Link>
                    {transitions.map((t) => (
                      <Button
                        key={t.to}
                        size="sm"
                        variant={t.label === "Ouvrir un litige" ? "destructive" : "default"}
                        className="h-8"
                        disabled={busyId === m.id}
                        onClick={() => act(m, t.to)}
                      >
                        {busyId === m.id ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <CircleDollarSign className="size-3.5" aria-hidden="true" />
                        )}
                        {t.label}
                      </Button>
                    ))}
                    {m.events.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setOpenHistory((h) => ({ ...h, [m.id]: !h[m.id] }))}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 text-xs text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <History className="size-3.5" aria-hidden="true" />
                        Historique
                        <ChevronDown
                          className={cn("size-3.5 transition-transform", showHistory && "rotate-180")}
                          aria-hidden="true"
                        />
                      </button>
                    ) : null}
                  </div>

                  {showHistory ? (
                    <ol className="mt-4 flex flex-col gap-2 border-t border-hairline pt-4">
                      {m.events.map((e) => (
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
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog
        open={Boolean(confirm)}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        {confirm ? (
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{confirm.transition.label}</DialogTitle>
              <DialogDescription>
                {confirm.transition.comment ? (
                  <>
                    Ajoutez un commentaire pour {confirm.mission.request?.project_type ?? "la mission"}{" "}
                    ({formatFCFA(confirm.mission.agreed_price_fcfa)}).
                  </>
                ) : confirm.transition.to === "cancelled" ? (
                  "Cette action annule la mission. Si le paiement est déjà confirmé, le client est automatiquement remboursé. Continuer ?"
                ) : (
                  "Un litige engage la vérification des deux parties. Continuer ?"
                )}
              </DialogDescription>
            </DialogHeader>
            {confirm.transition.comment ? (
              <Textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="État d'avancement, livrables, remarques…"
                className="rounded-xl"
              />
            ) : null}
            <DialogFooter className="gap-2 sm:justify-end">
              <Button variant="outline" onClick={() => setConfirm(null)}>
                Annuler
              </Button>
              <Button
                variant={
                  confirm.transition.to === "disputed" || confirm.transition.to === "cancelled"
                    ? "destructive"
                    : "default"
                }
                disabled={busyId === confirm.mission.id}
                onClick={() => {
                  const tr = confirm.transition;
                  setConfirm(null);
                  void updateStatus(
                    confirm.mission,
                    tr.to,
                    tr.comment ? comment : undefined,
                  );
                }}
              >
                {busyId === confirm.mission.id ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : null}
                Confirmer
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}