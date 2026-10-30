"use client";

/**
 * Cartes « accueil » de l'espace développeur.
 *
 * Reproduction des blocs observés dans la référence : parrainage,
 * partage du profil, derniers projets ouverts, position au classement.
 *
 * Toutes les valeurs affichées sont CALCULÉES côté serveur (page du
 * dashboard) depuis la base réelle : aucun compteur n'est simulé. Le
 * seul état local est le bouton « copié », qui reflète réellement le
 * résultat de navigator.clipboard.
 */

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  Gift,
  Link2,
  Share2,
  Trophy,
  UserPlus,
} from "lucide-react";
import { cn } from "cn";
import { formatFCFA } from "@/lib/formatting";

export type ReferralSummary = {
  code: string | null;
  total_signups: number;
  converted: number;
  points: number;
  points_per_conversion: number;
};

export type RecentProject = {
  id: string;
  /** public.requests n'a pas de colonne title : le libellé est la description. */
  description: string;
  budget: number | null;
  project_type: string | null;
  created_at: string;
};

function useCopy() {
  const [copied, setCopied] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  const copy = React.useCallback(async (value: string) => {
    if (!value) return false;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setFailed(false);
      window.setTimeout(() => setCopied(false), 2200);
      return true;
    } catch {
      // Clipboard indisponible (http, permissions) : on le signale plutôt
      // que d'afficher un faux « copié ».
      setFailed(true);
      window.setTimeout(() => setFailed(false), 3200);
      return false;
    }
  }, []);

  return { copied, failed, copy };
}

/**
 * Origine de l'application, calculée APRÈS le montage.
 *
 * `window.location.origin` n'existe pas côté serveur : le calculer
 * directement dans le rendu produisait une divergence serveur/client
 * (erreur React #418, désynchronisation d'hydratation). On rend donc
 * d'abord une chaîne vide, puis on remplit au montage.
 */
function useOrigin() {
  const [origin, setOrigin] = React.useState("");
  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  return origin;
}

function CopyButton({
  value,
  label,
  variant = "primary",
}: {
  value: string;
  label: string;
  variant?: "primary" | "ghost";
}) {
  const t = useTranslations("DevHome");
  const { copied, failed, copy } = useCopy();

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <button
        type="button"
        onClick={() => void copy(value)}
        disabled={!value}
        aria-live="polite"
        className={cn(
          "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50",
          variant === "primary"
            ? "bg-primary text-ink hover:bg-primary-hover"
            : "border border-hairline bg-background/60 text-foreground hover:border-primary/40"
        )}
      >
        {copied ? (
          <Check className="size-4 text-ink" aria-hidden="true" />
        ) : (
          <Copy className="size-4" aria-hidden="true" />
        )}
        {copied ? t("copied") : label}
      </button>
      {failed ? (
        <span className="text-xs text-error" role="status">
          {t("copyFailed")}
        </span>
      ) : null}
    </div>
  );
}

function CardShell({
  icon,
  title,
  children,
  className,
  ariaLabel,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <section
      aria-label={ariaLabel ?? title}
      className={cn(
        // min-w-0 est indispensable : ces cartes sont des items de CSS
        // Grid, dont `min-width` vaut `auto` par défaut. Sans cela, un
        // enfant en `truncate` (donc white-space: nowrap) impose sa
        // largeur min-content et fait déborder toute la grille.
        "flex min-w-0 flex-col rounded-2xl border border-hairline bg-card p-5",
        className
      )}
    >
      <h4 className="flex items-center gap-2.5 text-base font-semibold tracking-tight">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
          {icon}
        </span>
        {title}
      </h4>
      <div className="mt-4 flex flex-1 flex-col">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Parrainage                                                          */
/* ------------------------------------------------------------------ */

export function ReferralCard({
  summary,
}: {
  summary: ReferralSummary | null;
}) {
  const t = useTranslations("DevHome");
  const origin = useOrigin();
  const link =
    origin && summary?.code
      ? `${origin}/inscription-developpeur?ref=${encodeURIComponent(summary.code)}`
      : "";

  return (
    <CardShell icon={<Gift className="size-4" aria-hidden="true" />} title={t("referral.title")}>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {t("referral.subtitle")}
      </p>

      <dl className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-hairline bg-background/50 p-3 text-center">
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {t("referral.signups")}
          </dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">
            {summary?.total_signups ?? 0}
          </dd>
        </div>
        <div className="rounded-xl border border-hairline bg-background/50 p-3 text-center">
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {t("referral.converted")}
          </dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">
            {summary?.converted ?? 0}
          </dd>
        </div>
        <div className="rounded-xl border border-primary/30 bg-primary-soft p-3 text-center">
          <dt className="text-[11px] uppercase tracking-wide text-primary/80">
            {t("referral.points")}
          </dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-primary">
            {summary?.points ?? 0}
          </dd>
        </div>
      </dl>

      {summary?.code ? (
        <div className="mt-4 flex flex-col gap-2">
          <div className="flex min-w-0 items-center gap-2 rounded-xl border border-hairline bg-background/50 px-3 py-2">
            <Link2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <code className="min-w-0 truncate font-mono text-xs text-foreground">
              {link}
            </code>
          </div>
          <CopyButton value={link} label={t("referral.copy")} />
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">{t("referral.unavailable")}</p>
      )}
    </CardShell>
  );
}

/* ------------------------------------------------------------------ */
/* Partage du profil                                                   */
/* ------------------------------------------------------------------ */

export function ShareProfileCard({ username }: { username: string | null }) {
  const t = useTranslations("DevHome");
  const origin = useOrigin();
  const url = username ? `${origin}/dev/${encodeURIComponent(username)}` : "";

  if (!username) return null;

  return (
    <CardShell
      icon={<Share2 className="size-4" aria-hidden="true" />}
      title={t("share.title")}
    >
      <p className="text-sm leading-relaxed text-muted-foreground">
        {t("share.subtitle")}
      </p>
      <div className="mt-4 flex min-w-0 items-center gap-2 rounded-xl border border-hairline bg-background/50 px-3 py-2">
        <Link2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <code className="min-w-0 truncate font-mono text-xs text-foreground">{url}</code>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <CopyButton value={url} label={t("share.copy")} />
        <a
          href={`/dev/${encodeURIComponent(username)}`}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-hairline bg-background/60 px-4 text-sm font-medium text-foreground transition-colors outline-none hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <ExternalLink className="size-4" aria-hidden="true" />
          {t("share.preview")}
        </a>
      </div>
    </CardShell>
  );
}

/* ------------------------------------------------------------------ */
/* Derniers projets ouverts                                            */
/* ------------------------------------------------------------------ */

export function RecentProjectsCard({ projects }: { projects: RecentProject[] }) {
  const t = useTranslations("DevHome");

  const fmt = React.useCallback((iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const diff = Date.now() - d.getTime();
    const h = Math.floor(diff / 3_600_000);
    if (h < 1) return t("recent.justNow");
    if (h < 24) return t("recent.hours", { count: h });
    const j = Math.floor(h / 24);
    if (j < 30) return t("recent.days", { count: j });
    return d.toLocaleDateString();
  }, [t]);

  return (
    <CardShell
      icon={<UserPlus className="size-4" aria-hidden="true" />}
      title={t("recent.title")}
    >
      {projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("recent.empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-hairline">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/briefs/${p.id}`}
                className="group flex items-start gap-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">
                    {p.description}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    {p.budget ? <span>{formatFCFA(p.budget)}</span> : null}
                    {p.project_type ? <span>· {p.project_type}</span> : null}
                    <span>· {fmt(p.created_at)}</span>
                  </span>
                </span>
                <ArrowRight
                  className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link
        href="/briefs"
        className="mt-4 inline-flex items-center gap-1.5 self-start text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        {t("recent.viewAll")}
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </CardShell>
  );
}

/* ------------------------------------------------------------------ */
/* Position au classement                                              */
/* ------------------------------------------------------------------ */
/**
 * Affiche le score de réputation et le niveau réels du développeur
 * (champs déjà chargés par la page dashboard).
 *
 * On n'affiche PAS un numéro de rang : `get_leaderboard` renvoie une
 * page du classement, pas la position du requérant, et je ne vais pas
 * faire mentir un chiffre. Le lien mène au classement complet.
 */
export function RankCard({
  reputationScore,
  reputationLevel,
}: {
  reputationScore: number | null;
  reputationLevel: string | null;
}) {
  const t = useTranslations("DevHome");

  return (
    <CardShell icon={<Trophy className="size-4" aria-hidden="true" />} title={t("rank.title")}>
      <p className="text-sm leading-relaxed text-muted-foreground">{t("rank.subtitle")}</p>

      <div className="mt-4 flex items-end gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {t("rank.score")}
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums leading-none text-primary">
            {reputationScore ?? 0}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {t("rank.level")}
          </p>
          <p className="mt-1 text-lg font-semibold leading-none">
            {reputationLevel ? (
              <span className="capitalize">{reputationLevel}</span>
            ) : (
              "—"
            )}
          </p>
        </div>
      </div>

      <Link
        href="/classement"
        className="mt-5 inline-flex items-center gap-1.5 self-start text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        {t("rank.see")}
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </CardShell>
  );
}
