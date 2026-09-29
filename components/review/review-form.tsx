"use client";

import * as React from "react";
import Link from "next/link";
import {
  Check,
  CheckCircle2,
  Info,
  Loader2,
  ShieldCheck,
  Star,
  Undo2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatFCFA } from "@/lib/formatting";
import {
  REVIEW_CRITERIA,
  REVIEW_QUESTIONS,
  REVIEW_QUESTION_ANSWERS,
  starLabel,
} from "@/lib/reviews-labels";
import type {
  ReviewCriteria,
  ReviewForRequest,
  ReviewQuestions,
} from "@/types/database";
import { cn } from "cn";

const STEPS = [
  { step: 1, label: "Note globale & critères" },
  { step: 2, label: "Commentaire & questions" },
  { step: 3, label: "Résumé & publication" },
];

function cleanRpcError(message: unknown): string {
  if (typeof message !== "string") return "Une erreur est survenue. Réessayez.";
  const codeMatch = message.match(/\b(TL\w{3})\b/);
  const code = codeMatch ? codeMatch[1] : null;
  const base = message.replace(/\s*\(code:\s*\w+\)?.*/i, "").trim();
  const map: Record<string, string> = {
    TLNAU: "Connectez-vous pour laisser un avis.",
    TLFOR: "Votre compte ne peut pas déposer cet avis.",
    TLTMP: "La mission doit être terminée pour être évaluée.",
    TLNDV: "Aucun développeur n’est rattaché à cette mission.",
    TLBAD: "Certaines informations saisies sont invalides. Vérifiez le formulaire.",
    TLNOK: "Mission introuvable.",
  };
  if (code && map[code]) return map[code];
  return base || "Une erreur est survenue. Réessayez.";
}

export function ReviewForm({ context }: { context: ReviewForRequest }) {
  const [step, setStep] = React.useState(context.review?.id ? 1 : 1);
  const [rating, setRating] = React.useState(context.review?.rating ?? 0);
  const [criteria, setCriteria] = React.useState<ReviewCriteria>(
    context.review?.criteria ?? {}
  );
  const [comment, setComment] = React.useState(context.review?.comment ?? "");
  const [questions, setQuestions] = React.useState<ReviewQuestions>(
    context.review?.questions ?? {}
  );
  const [assets, setAssets] = React.useState<string[]>(() =>
    Array.from({ length: 3 }, (_, i) => context.review?.assets?.[i] ?? "")
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const isPublished = Boolean(context.review?.id);

  if (done) {
    return (
      <div className="mt-8 rounded-3xl border border-[#166534]/60 bg-[#0F2E18] p-8 text-center sm:p-12">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#4ADE80]/15 text-[#4ADE80]">
          <CheckCircle2 className="size-8" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">
          Merci pour votre avis !
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          Votre avis aide la communauté TERANGA LABS à choisir les meilleurs
          développeurs. {isPublished ? "Il a bien été mis à jour." : "Il est maintenant publié."}{" "}
          {context.developer?.full_name ? `Le développeur pourra y répondre publiquement.` : null}
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link href="/client" className="btn btn-primary">
            Retour à mon espace client
          </Link>
          <Link
            href={`/dev/${context.developer?.username ?? ""}`}
            className="btn btn-ghost"
          >
            Voir le profil du développeur
          </Link>
        </div>
      </div>
    );
  }

  if (context.request.status !== "terminé") {
    return (
      <div className="mt-8 rounded-3xl border border-hairline bg-[#141414] p-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Les avis arrivent après une mission terminée
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          Cette mission n’est pas encore au statut « terminé ». Vous pourrez
          laisser votre avis dès que le développeur aura livré le projet.
        </p>
        <Link href="/client" className="btn btn-primary mt-6">
          Retour à mon espace client
        </Link>
      </div>
    );
  }

  const setCriterion = (key: string, value: number) =>
    setCriteria((prev) => ({ ...prev, [key]: value }));

  const criteriaComplete = Object.keys(REVIEW_CRITERIA).every((_, i) =>
    Boolean(criteria[REVIEW_CRITERIA[i].key])
  );
  const questionsComplete = Object.keys(REVIEW_QUESTIONS).every((_, i) =>
    Boolean(questions[REVIEW_QUESTIONS[i].key])
  );

  const canNext =
    step === 1 ? rating > 0 && criteriaComplete : step === 2 ? questionsComplete : false;

  const goNext = () => {
    setError(null);
    if (!canNext) {
      setError(
        step === 1
          ? "Choisissez la note globale et renseignez tous les critères."
          : "Répondez aux quatre questions."
      );
      return;
    }
    setStep((s) => s + 1);
  };

  const publish = async () => {
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const assetUrls = assets.map((a) => (a || "").trim()).filter(Boolean);
    const { error: err } = await supabase.rpc("submit_review", {
      p_request_id: context.request.id,
      p_rating: rating,
      p_comment: comment.trim() || "",
      p_criteria: criteria as unknown as Record<string, unknown>,
      p_questions: questions as unknown as Record<string, unknown>,
      p_assets: assetUrls,
    });
    setSubmitting(false);
    if (err) {
      setError(cleanRpcError(err.message));
      return;
    }
    setDone(true);
  };

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-hairline bg-[#141414] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-hairline font-display text-lg font-bold text-[#F2F2F2]">
            {(context.developer?.full_name || "?").charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold">
              {context.developer?.full_name ?? "Développeur"}
              {context.developer?.username
                ? ` · @${context.developer.username}`
                : ""}
            </p>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {context.request.project_type} · {formatFCFA(context.request.budget)}
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-[#166534]/60 bg-[#0F2E18] px-3 py-1.5 text-xs font-medium text-[#4ADE80] sm:self-center">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          Avis vérifié lié à cette mission
        </span>
      </div>

      {isPublished ? (
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-[#166534]/60 bg-[#0F2E18] p-4 text-sm">
          <Check className="mt-0.5 size-4 shrink-0 text-[#4ADE80]" aria-hidden="true" />
          <p className="text-muted-foreground">
            Un avis est déjà publié pour cette mission. Vous pouvez le modifier.
          </p>
        </div>
      ) : null}

      <div className="mt-6 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.step}>
            {i > 0 ? <span className="h-px flex-1 bg-hairline" aria-hidden="true" /> : null}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-medium",
                step === s.step ? "text-[#F2F2F2]" : "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
                  step === s.step
                    ? "bg-primary text-[#0D0D0D]"
                    : step > s.step
                      ? "bg-[#4ADE80] text-[#0D0D0D]"
                      : "bg-hairline text-muted-foreground"
                )}
              >
                {step > s.step ? <Check className="size-3" aria-hidden="true" /> : s.step}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </span>
          </React.Fragment>
        ))}
      </div>

      {error ? (
        <div className="mt-5 rounded-2xl border border-[#F87171]/30 bg-[#2A1212] p-4 text-sm text-[#F87171]">
          {error}
        </div>
      ) : null}

      <div className="mt-5 rounded-3xl border border-hairline bg-[#141414] p-5 sm:p-7">
        {step === 1 ? (
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Note globale
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Votre note globale sur l’ensemble de la mission.
            </p>
            <div className="mt-4">
              <StarRating value={rating} onChange={setRating} size="lg" />
              <p className="mt-2 text-sm font-medium">
                {rating > 0 ? starLabel(rating) : "Sélectionnez une note"}
              </p>
            </div>

            <h3 className="mt-8 text-lg font-semibold tracking-tight">
              Note par critère
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Précisez votre ressenti sur chacun des 8 critères ci-dessous.
            </p>
            <ul className="mt-4 flex flex-col gap-4">
              {REVIEW_CRITERIA.map((c) => (
                <li key={c.key} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{c.label}</span>
                    {criteria[c.key] ? (
                      <span className="text-xs text-muted-foreground">
                        {starLabel(criteria[c.key])}
                      </span>
                    ) : null}
                  </div>
                  <StarRating
                    value={criteria[c.key] ?? 0}
                    onChange={(v) => setCriterion(c.key, v)}
                    size="md"
                  />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {step === 2 ? (
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Votre commentaire
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Décrivez votre expérience avec des mots simples (facultatif mais
              recommandé).
            </p>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={1500}
              rows={5}
              placeholder="Points forts, points à améliorer, conseils aux futurs clients…"
              className="mt-3 w-full resize-y rounded-2xl border border-hairline bg-surface px-4 py-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
            <div className="mt-1 text-right text-xs text-muted-foreground">
              {comment.length}/1500
            </div>

            <h3 className="mt-8 text-lg font-semibold tracking-tight">
              Questions (obligatoires)
            </h3>
            <ul className="mt-4 flex flex-col gap-5">
              {REVIEW_QUESTIONS.map((q) => (
                <li key={q.key}>
                  <p className="text-sm font-medium">{q.label}</p>
                  <div
                    className="mt-2 flex flex-wrap gap-2"
                    role="radiogroup"
                    aria-label={q.label}
                  >
                    {q.answers.map((a) => {
                      const active = questions[q.key] === a;
                      return (
                        <button
                          key={a}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() =>
                            setQuestions((prev) => ({ ...prev, [q.key]: a }))
                          }
                          className={cn(
                            "inline-flex h-9 items-center rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                            active
                              ? "border-primary/60 bg-[#2A1A10] text-[#F2A378]"
                              : "border-hairline text-muted-foreground hover:bg-[#1E1E1E]"
                          )}
                        >
                          {REVIEW_QUESTION_ANSWERS.find((x) => x.value === a)?.label}
                        </button>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>

            <h3 className="mt-8 text-lg font-semibold tracking-tight">
              Captures (facultatif)
            </h3>
            <div className="mt-2 flex items-start gap-2.5 rounded-2xl border border-primary/30 bg-[#1A120B] p-4 text-sm text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <p>
                Vous pouvez ajouter jusqu’à 3 liens d’images (site livré,
                échanges…) en respectant les droits d’auteur. Évitez de publier
                des données personnelles (téléphone, email, informations de
                paiement).
              </p>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {assets.map((a, i) => (
                <input
                  key={i}
                  type="url"
                  value={a}
                  onChange={(e) =>
                    setAssets((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))
                  }
                  placeholder={`Capture ${i + 1} (https://…)`}
                  className="w-full rounded-xl border border-hairline bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
              ))}
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Résumé de votre avis
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Vérifiez le contenu avant publication. Vous pourrez le modifier
              plus tard.
            </p>

            <dl className="mt-5 flex flex-col gap-4">
              <SummaryRow label="Note globale">
                <div className="flex items-center gap-1.5">
                  <Stars value={rating} />
                  <span className="text-sm text-muted-foreground">{starLabel(rating)}</span>
                </div>
              </SummaryRow>

              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Critères
                </dt>
                <dd className="mt-2">
                  <ul className="flex flex-col gap-1.5">
                    {REVIEW_CRITERIA.map((c) => (
                      <li
                        key={c.key}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span>{c.label}</span>
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          {criteria[c.key] ?? 0}
                          <Star className="size-3 fill-current text-[#F5C26B]" aria-hidden="true" />
                          /5
                        </span>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>

              <SummaryRow label="Commentaire">
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {comment.trim() || "Aucun commentaire."}
                </p>
              </SummaryRow>

              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Questions
                </dt>
                <dd className="mt-2">
                  <ul className="flex flex-col gap-1.5">
                    {REVIEW_QUESTIONS.map((q) => (
                      <li key={q.key} className="flex items-start justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">{q.label}</span>
                        <span className="shrink-0 font-medium">
                          {REVIEW_QUESTION_ANSWERS.find((x) => x.value === questions[q.key])
                            ?.label ?? "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>

              <SummaryRow label="Captures">
                {assets.map((a) => a.trim()).filter(Boolean).length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {assets
                      .map((a) => a.trim())
                      .filter(Boolean)
                      .map((a) => (
                        <li key={a}>
                          <a
                            href={a}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                          >
                            {a}
                          </a>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucune capture.</p>
                )}
              </SummaryRow>
            </dl>

            <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 shrink-0 text-[#4ADE80]" aria-hidden="true" />
              Cet avis est lié à votre mission et ne peut être déposé qu’une
              seule fois par mission. Il sera affiché comme « avis vérifié ».
            </p>
          </div>
        ) : null}

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => (step === 1 ? setStep(1) : setStep(step - 1))}
            disabled={step === 1}
            className="btn btn-ghost inline-flex items-center gap-2 disabled:pointer-events-none disabled:opacity-40"
          >
            <Undo2 className="size-4" aria-hidden="true" />
            Retour
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={goNext}
              className="btn btn-primary"
            >
              Continuer
            </button>
          ) : (
            <button
              type="button"
              onClick={publish}
              disabled={submitting}
              className="btn btn-primary inline-flex items-center gap-2 disabled:pointer-events-none disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Publication…
                </>
              ) : (
                <>
                  <Check className="size-4" aria-hidden="true" />
                  {isPublished ? "Mettre à jour l’avis" : "Publier mon avis"}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StarRating({
  value,
  onChange,
  size = "md",
}: {
  value: number;
  onChange: (v: number) => void;
  size?: "md" | "lg";
}) {
  return (
    <div
      className="flex items-center gap-1"
      role="radiogroup"
      aria-label="Note en étoiles"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
          onClick={() => onChange(n)}
          className={cn(
            "rounded-lg outline-none transition-transform focus-visible:ring-2 focus-visible:ring-primary/50",
            size === "lg" ? "p-0.5" : "p-0.5"
          )}
        >
          <Star
            className={cn(
              "transition-colors",
              size === "lg" ? "size-8" : "size-6",
              n <= value
                ? "fill-current text-[#F5C26B]"
                : "text-[#3A3A3A] hover:text-[#5A5A5A]"
            )}
            aria-hidden="true"
          />
        </button>
      ))}
    </div>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "size-4",
            n <= value ? "fill-current text-[#F5C26B]" : "text-[#3A3A3A]"
          )}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

function SummaryRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#232323] bg-[#101010] p-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1.5">{children}</dd>
    </div>
  );
}