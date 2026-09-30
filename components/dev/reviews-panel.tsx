"use client";

import * as React from "react";
import {
  BadgeCheck,
  Check,
  EyeOff,
  Loader2,
  MessageSquareReply,
  ShieldCheck,
  Star,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatFCFA, formatDate } from "@/lib/formatting";
import { projectTypeLabel } from "@/lib/dev-missions-labels";
import {
  REVIEW_CRITERIA,
  REVIEW_QUESTIONS,
  reviewCriteriaLabel,
  reviewQuestionLabel,
  starLabel,
} from "@/lib/reviews-labels";
import type { DeveloperReviewItem, MyDeveloperReviews } from "@/types/database";
import { EmptyState } from "@/components/empty-state";
import { cn } from "cn";

export function DevReviewsPanel({
  initial,
}: {
  initial: MyDeveloperReviews | null;
}) {
  const [data, setData] = React.useState<MyDeveloperReviews | null>(initial);
  const [responding, setResponding] = React.useState<string | null>(null);
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);

  const saveResponse = async (review: DeveloperReviewItem) => {
    setResponding(review.id);
    setError(null);
    const supabase = createClient();
    const text = (drafts[review.id] ?? review.response ?? "").trim();
    const { error: err } = await supabase.rpc("respond_to_review", {
      p_review_id: review.id,
      p_response: text,
    });
    setResponding(null);
    if (err) {
      setError("Impossible d’enregistrer la réponse. Réessayez.");
      return;
    }
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        reviews: prev.reviews.map((r) =>
          r.id === review.id
            ? { ...r, response: text || null, responded_at: new Date().toISOString() }
            : r
        ),
      };
    });
  };

  if (!data) {
    return (
      <div>
        <EmptyState
          title="Impossible de charger vos avis"
          description="Rechargez la page dans quelques instants."
        />
      </div>
    );
  }

  if (data.reviews.length === 0) {
    return (
      <div>
        <EmptyState
          title="Aucun avis pour le moment"
          description="Lorsqu’un client a terminé une mission, son avis et sa note apparaîtront ici. Répondez publiquement à chaque avis pour renforcer votre crédibilité."
        />
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={<Star className="size-4" aria-hidden="true" />}
          value={`${data.average}/5`}
          label="Note moyenne"
        />
        <SummaryCard
          icon={<BadgeCheck className="size-4" aria-hidden="true" />}
          value={String(data.total)}
          label="Avis reçus"
        />
        <SummaryCard
          icon={<ShieldCheck className="size-4" aria-hidden="true" />}
          value={`${data.satisfaction} %`}
          label="Clients satisfaits (4-5 ★)"
        />
      </div>

      <div className="mt-6 rounded-2xl border border-hairline bg-card p-5 sm:p-6">
        <h3 className="text-sm font-semibold tracking-tight">
          Vos moyennes par critère
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Calculées automatiquement à partir de vos avis vérifiés.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          {REVIEW_CRITERIA.map((c) => {
            const value = data.average_criteria?.[c.key];
            return (
              <div key={c.key}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-muted-foreground">
                    {c.label}
                  </span>
                  <span className="shrink-0 text-xs font-semibold">
                    {value != null ? `${value}/5` : "—"}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-hairline">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${Math.max(0, Math.min(100, ((value ?? 0) / 5) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {error ? (
        <div className="mt-5 rounded-2xl border border-error/30 bg-error-soft p-4 text-sm text-error">
          {error}
        </div>
      ) : null}

      <ul className="mt-6 flex flex-col gap-4">
        {data.reviews.map((review) => (
          <li
            key={review.id}
            className={cn(
              "rounded-2xl border p-5",
              review.hidden ? "border-error/25 bg-error-soft" : "border-hairline bg-card"
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">
                  {review.client_name ?? "Client"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {projectTypeLabel(review.request_type)} ·{" "}
                  {review.request_budget ? formatFCFA(review.request_budget) : ""}{" "}
                  · {formatDate(review.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={cn(
                      "size-4",
                      n <= review.rating
                        ? "fill-current text-warning"
                        : "text-border-strong"
                    )}
                    aria-hidden="true"
                  />
                ))}
              </div>
            </div>

            <p className="mt-2 text-sm font-medium">{starLabel(review.rating)}</p>

            {review.comment ? (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {review.comment}
              </p>
            ) : null}

            {Object.keys(review.criteria ?? {}).length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {REVIEW_CRITERIA.filter((c) => review.criteria?.[c.key]).map((c) => (
                  <span
                    key={c.key}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                    title={reviewCriteriaLabel(c.key)}
                  >
                    {c.label}
                    <span className="font-semibold text-foreground">
                      {review.criteria?.[c.key]}★
                    </span>
                  </span>
                ))}
              </div>
            ) : null}

            {Object.keys(review.questions ?? {}).length > 0 ? (
              <dl className="mt-3 flex flex-col gap-1 rounded-xl bg-surface p-3 text-xs">
                {REVIEW_QUESTIONS.map((q) =>
                  review.questions?.[q.key] ? (
                    <div key={q.key} className="flex items-start justify-between gap-3">
                      <dt className="text-muted-foreground">{reviewQuestionLabel(q.key)}</dt>
                      <dd className="shrink-0 font-medium">
                        {q.answers.find((a) => a === review.questions?.[q.key]) ===
                        review.questions?.[q.key]
                          ? String(review.questions?.[q.key]).charAt(0).toUpperCase() +
                            String(review.questions?.[q.key]).slice(1)
                          : "—"}
                      </dd>
                    </div>
                  ) : null
                )}
              </dl>
            ) : null}

            {review.hidden ? (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-error/25 bg-error-soft p-3 text-xs text-muted-foreground">
                <EyeOff className="mt-0.5 size-4 shrink-0 text-error" aria-hidden="true" />
                <p>
                  Avis masqué par la modération.
                  {review.admin_note ? ` Motif : ${review.admin_note}.` : ""}{" "}
                  La note n’est pas comptée dans vos statistiques publiques.
                </p>
              </div>
            ) : null}

            <div className="mt-4 border-t border-hairline pt-4">
              {review.response ? (
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <MessageSquareReply className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Votre réponse publique
                      </p>
                      {review.responded_at ? (
                        <span className="text-xs text-muted-foreground">
                          {formatDate(review.responded_at)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                      {review.response}
                    </p>
                  </div>
                </div>
              ) : null}

              <label className="mt-3 block text-xs font-medium text-muted-foreground">
                {review.response ? "Modifier votre réponse" : "Répondre publiquement à cet avis"}
              </label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start">
                <textarea
                  value={drafts[review.id] ?? review.response ?? ""}
                  onChange={(e) =>
                    setDrafts((prev) => ({ ...prev, [review.id]: e.target.value }))
                  }
                  maxLength={2000}
                  rows={3}
                  disabled={responding === review.id}
                  placeholder="Remercier le client, préciser un point de contexte… votre réponse ne modifie jamais sa note."
                  className="w-full flex-1 resize-y rounded-xl border border-hairline bg-surface px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => saveResponse(review)}
                  disabled={responding === review.id}
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-foreground px-4 text-sm font-medium text-ink transition-colors outline-none hover:bg-foreground focus-visible:ring-2 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-60"
                >
                  {responding === review.id ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Check className="size-4" aria-hidden="true" />
                  )}
                  {review.response ? "Mettre à jour" : "Publier"}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Votre réponse est publique et n’altère jamais la note ni les
                critères de l’avis.
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SummaryCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-hairline bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
          {icon}
        </span>
        {label}
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}