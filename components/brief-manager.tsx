"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Flag,
  Loader2,
  Lock,
  Phone,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { formatFCFA, formatDate } from "@/lib/formatting";
import { REQUEST_STATUS_LABELS } from "@/lib/tokens";
import { cn } from "cn";

type Unlocker = {
  developer_id: string;
  full_name: string | null;
  whatsapp: string | null;
  skills: string[] | null;
  unlocked_at: string;
  rating: number | null;
};

export type BriefManagementData = {
  id: string;
  client_name: string;
  client_whatsapp: string;
  client_city: string;
  project_type: string;
  budget: number;
  description: string;
  status: string;
  hidden: boolean;
  created_at: string;
  unlocks_count: number;
  unlocks: Unlocker[];
};

const STATUS_ACTIONS: { status: string; label: string; main?: boolean }[] = [
  { status: "attribué", label: "Attribuer" },
  { status: "terminé", label: "Marquer terminé" },
  { status: "fermé", label: "Fermer le brief" },
];

export function BriefManager({
  data,
  managementKey,
}: {
  data: BriefManagementData;
  managementKey: string;
}) {
  const [brief, setBrief] = React.useState(data);
  const [busy, setBusy] = React.useState(false);
  const statusHint = brief.unlocks_count > 0 ? brief.unlocks_count : 0;

  const changeStatus = async (status: string) => {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("update_brief_status", {
      p_management_key: managementKey,
      p_status: status,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message || "Impossible de mettre à jour.");
      return;
    }
    setBrief({ ...brief, status });
    toast.success("Brief mis à jour");
  };

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-2xl border border-hairline bg-[#141414] p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight">
                {brief.client_name}
              </h2>
              <Badge className="capitalize">
                {REQUEST_STATUS_LABELS[brief.status] ?? brief.status}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {brief.client_city} · {brief.project_type} ·{" "}
              {formatFCFA(brief.budget)}
            </p>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
              {brief.description}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-[#1E1E1E] p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Lock className="size-4 text-primary" aria-hidden="true" />
            {statusHint} développeur{statusHint > 1 ? "s" : ""} a ouvert une
            discussion
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Chaque développeur a payé 1 Token pour vous écrire : ce sont des
            profils sérieux. Répondez-leur dans la messagerie interne du site.
          </p>
        </div>

        {brief.status !== "fermé" ? (
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Gérer le statut du projet
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {STATUS_ACTIONS.map((action) => (
                <Button
                  key={action.status}
                  variant={action.status === "attribué" ? "default" : "outline"}
                  size="sm"
                  className="rounded-lg"
                  disabled={busy || brief.status === action.status}
                  onClick={() => changeStatus(action.status)}
                >
                  {busy ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  ) : action.status === "terminé" ? (
                    <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  ) : (
                    <Flag className="size-3.5" aria-hidden="true" />
                  )}
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section aria-label="Développeurs ayant débloqué le contact">
        <h2 className="text-lg font-semibold tracking-tight">
          Développeurs en contact
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {brief.unlocks_count} développeur{brief.unlocks_count > 1 ? "s" : ""}{" "}
          a ouvert une discussion avec vous. Répondez dans votre messagerie et notez chacun après projet.
        </p>

        {brief.unlocks.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="En attendant les premiers contacts"
              description="Les développeurs qui ouvrent une discussion apparaîtront ici."
            />
          </div>
        ) : (
          <ul className="mt-6 space-y-4">
            {brief.unlocks.map((dev) => (
              <li
                key={dev.developer_id}
                className="rounded-2xl border border-hairline bg-[#141414] p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold tracking-tight">
                      {dev.full_name ?? "Développeur"}
                    </p>
                    {dev.skills?.length ? (
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {dev.skills.join(" · ")}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      a ouvert une discussion avec vous le {formatDate(dev.unlocked_at)}
                    </p>
                  </div>
                  {dev.whatsapp ? (
                    <span
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-hairline bg-[#1E1E1E] px-3 text-xs font-medium text-muted-foreground"
                      title="Contact privé partagé après accord"
                    >
                      <Phone className="size-3.5" aria-hidden="true" />
                      {dev.whatsapp}
                    </span>
                  ) : null}
                </div>

                <ReviewForm
                  managementKey={managementKey}
                  developerId={dev.developer_id}
                  currentRating={dev.rating}
                  disabled={brief.status !== "terminé" && brief.status !== "fermé"}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ReviewForm({
  managementKey,
  developerId,
  currentRating,
  disabled,
}: {
  managementKey: string;
  developerId: string;
  currentRating: number | null;
  disabled: boolean;
}) {
  const [rating, setRating] = React.useState(currentRating ?? 0);
  const [hover, setHover] = React.useState(0);
  const [comment, setComment] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const submit = async () => {
    if (!rating) {
      toast.error("Choisissez une note entre 1 et 5.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("submit_review", {
      p_management_key: managementKey,
      p_developer_id: developerId,
      p_rating: rating,
      p_comment: comment.trim(),
    });
    setSaving(false);
    if (error) {
      toast.error(error.message || "Impossible d’envoyer l’avis.");
      return;
    }
    toast.success("Avis enregistré. Merci !");
  };

  return (
    <div className="mt-5 rounded-xl border border-hairline bg-[#1E1E1E] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {currentRating ? "Modifier votre avis" : "Laisser une note"}
        </Label>
        {disabled ? (
          <span className="text-xs text-muted-foreground">
            Les avis sont ouverts une fois le projet terminé.
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            className="rounded outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
          >
            <Star
              className={cn(
                "size-6 transition-colors",
                n <= (hover || rating)
                  ? "fill-primary text-primary"
                  : "text-[#3A3A3A]",
                disabled && "opacity-60"
              )}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>

      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        disabled={disabled}
        rows={2}
        className="mt-3 min-h-16 rounded-xl"
        placeholder="Commentaire (facultatif) — sérieux, projet bien livré, communication…"
      />

      <Button
        type="button"
        size="sm"
        className="mt-3 rounded-lg"
        disabled={disabled || saving}
        onClick={submit}
      >
        {saving ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Star className="size-3.5" aria-hidden="true" />
        )}
        {rating ? "Enregistrer l’avis" : "Envoyer l’avis"}
      </Button>
    </div>
  );
}