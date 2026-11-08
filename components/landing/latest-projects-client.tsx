"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  Clock3,
  Eye,
  MessageSquare,
  Plus,
  Search,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "cn";
import { formatFCFA } from "@/lib/formatting";
import type { PublicRequest } from "@/types/database";

export type LandingProjectItem = PublicRequest & {
  features?: unknown[] | null;
};

export type BriefStats = { offers: number; views: number };

type SortKey = "recent" | "budget_desc" | "budget_asc";
type BudgetKey = "all" | "lt150" | "150_300" | "gt300";

export function LatestProjectsClient({
  briefs,
  statsMap,
  types,
  labels,
}: {
  briefs: LandingProjectItem[];
  statsMap: Record<string, BriefStats>;
  types: Record<string, string>;
  labels: {
    open: string;
    viewProject: string;
    cta: string;
  };
}) {
  const locale = useLocale();
  const isEn = locale === "en";

  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [city, setCity] = React.useState("all");
  const [budget, setBudget] = React.useState<BudgetKey>("all");
  const [sort, setSort] = React.useState<SortKey>("recent");

  const cities = React.useMemo(() => {
    const set = new Set<string>();
    for (const b of briefs) {
      const c = b.client_city?.trim();
      if (c) set.add(c);
    }
    return [...set].sort();
  }, [briefs]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = briefs.filter((b) => {
      if (category !== "all" && b.project_type !== category) return false;
      if (city !== "all" && b.client_city?.trim() !== city) return false;
      if (budget === "lt150" && b.budget >= 150000) return false;
      if (budget === "150_300" && (b.budget < 150000 || b.budget > 300000)) return false;
      if (budget === "gt300" && b.budget <= 300000) return false;
      if (q) {
        const typeLabel = types[b.project_type] ?? b.project_type;
        const hay = `${b.client_name} ${b.client_city} ${typeLabel} ${b.description ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sort === "budget_desc") return (b.budget ?? 0) - (a.budget ?? 0);
      if (sort === "budget_asc") return (a.budget ?? 0) - (b.budget ?? 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [briefs, query, category, city, budget, sort, types]);

  const hasFilters =
    Boolean(query.trim()) ||
    category !== "all" ||
    city !== "all" ||
    budget !== "all";

  const resetFilters = () => {
    setQuery("");
    setCategory("all");
    setCity("all");
    setBudget("all");
    setSort("recent");
  };

  const visible = filtered.slice(0, 8);

  return (
    <div className="mt-8">
      {/* Barre de recherche et filtres fonctionnels */}
      <div className="rounded-2xl border border-hairline bg-card/80 p-4 backdrop-blur sm:p-5">
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label={isEn ? "Filter by project category" : "Filtrer par catégorie de projet"}
        >
          <button
            type="button"
            onClick={() => setCategory("all")}
            aria-pressed={category === "all"}
            className={cn(
              "inline-flex h-9 items-center rounded-full border px-3.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              category === "all"
                ? "border-primary bg-primary-soft text-primary"
                : "border-hairline bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            {isEn ? "All categories" : "Toutes les catégories"}
          </button>
          {Object.entries(types).map(([key, label]) => {
            const active = category === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(active ? "all" : key)}
                aria-pressed={active}
                className={cn(
                  "inline-flex h-9 items-center rounded-full border px-3.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                  active
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-hairline bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                isEn
                  ? "Filter by keyword, city, need…"
                  : "Filtrer par mot-clé, ville, besoin…"
              }
              aria-label={
                isEn ? "Search in recent projects" : "Rechercher dans les projets récents"
              }
              className="h-10 w-full rounded-xl border border-hairline bg-background/70 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </div>

          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            aria-label={isEn ? "Filter by city" : "Filtrer par ville"}
            className="h-10 rounded-xl border border-hairline bg-background/70 px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <option value="all">{isEn ? "All cities" : "Toutes les villes"}</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={budget}
            onChange={(e) => setBudget(e.target.value as BudgetKey)}
            aria-label={isEn ? "Filter by budget" : "Filtrer par budget"}
            className="h-10 rounded-xl border border-hairline bg-background/70 px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <option value="all">{isEn ? "All budgets" : "Tous les budgets"}</option>
            <option value="lt150">
              {isEn ? "Under 150,000 FCFA" : "Moins de 150 000 FCFA"}
            </option>
            <option value="150_300">150 000 – 300 000 FCFA</option>
            <option value="gt300">
              {isEn ? "Over 300,000 FCFA" : "Plus de 300 000 FCFA"}
            </option>
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label={isEn ? "Sort projects" : "Trier les projets"}
            className="h-10 rounded-xl border border-hairline bg-background/70 px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <option value="recent">
              {isEn ? "Sort: Most recent" : "Tri : Plus récents"}
            </option>
            <option value="budget_desc">
              {isEn ? "Sort: Highest budget" : "Tri : Budget décroissant"}
            </option>
            <option value="budget_asc">
              {isEn ? "Sort: Lowest budget" : "Tri : Budget croissant"}
            </option>
          </select>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {isEn
              ? `${filtered.length} open project${filtered.length > 1 ? "s" : ""} matching`
              : `${filtered.length} projet${filtered.length > 1 ? "s" : ""} ouvert${filtered.length > 1 ? "s" : ""} correspondant${filtered.length > 1 ? "s" : ""}`}
          </span>
          {hasFilters ? (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <X className="size-3.5" aria-hidden="true" />
              {isEn ? "Reset filters" : "Réinitialiser les filtres"}
            </button>
          ) : null}
        </div>
      </div>

      {/* Grille des vrais projets ou état vide soigné */}
      {visible.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-hairline bg-card p-8 text-center sm:p-10">
          <p className="font-headings text-lg font-bold tracking-tight">
            {hasFilters
              ? isEn
                ? "No open project matches these filters"
                : "Aucun projet ouvert ne correspond à ces filtres"
              : isEn
                ? "No open project available right now"
                : "Aucun projet ouvert disponible pour le moment"}
          </p>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
            {hasFilters
              ? isEn
                ? "Broaden your criteria, publish a project for free, or create a developer alert to be notified as soon as a new project goes live."
                : "Élargissez vos critères, publiez un projet gratuitement ou activez vos alertes développeur pour être prévenu dès la mise en ligne d’un nouveau besoin."
              : isEn
                ? "Publish your project for free in 2 minutes or create a developer alert to receive new projects."
                : "Publiez votre projet gratuitement en 2 minutes ou activez vos alertes développeur pour recevoir les prochains projets."}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {hasFilters ? (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-hairline bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors outline-none hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <X className="size-4" aria-hidden="true" />
                {isEn ? "Reset filters" : "Réinitialiser les filtres"}
              </button>
            ) : null}
            <Link
              href="/poster"
              className="btn-shine inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-ink outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <Plus className="size-4" aria-hidden="true" />
              {isEn ? "Publish a project" : "Publier un projet"}
            </Link>
            <Link
              href="/inscription-developpeur"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-primary/30 bg-primary-soft px-5 py-2.5 text-sm font-semibold text-primary transition-colors outline-none hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <Bell className="size-4" aria-hidden="true" />
              {isEn ? "Create a project alert" : "Créer une alerte projet"}
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
          {visible.map((brief) => {
            const title = firstLine(brief.description) || brief.client_name;
            const tags = (brief.features ?? []).map(String).filter(Boolean).slice(0, 3);
            const href = `/briefs/${brief.id}`;
            const initials = clientInitials(brief.client_name);
            const st = statsMap[brief.id];
            const typeLabel = types[brief.project_type] ?? brief.project_type;

            return (
              <article
                key={brief.id}
                className="group relative flex h-full flex-col rounded-2xl border border-hairline bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_24px_60px_-30px_rgba(57,255,136,0.35)] sm:p-6"
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary-soft font-headings text-xs font-bold text-primary"
                  >
                    {initials}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{brief.client_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {brief.client_city}
                    </p>
                  </div>
                  <div className="ml-auto flex shrink-0 flex-col items-end gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock3 className="size-3" aria-hidden="true" />
                      {relativeTime(brief.created_at, locale)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      <span
                        className="size-1.5 rounded-full bg-primary"
                        aria-hidden="true"
                      />
                      {labels.open}
                    </span>
                  </div>
                </div>

                <span className="mt-4 inline-flex w-fit items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {typeLabel}
                </span>

                <h3 className="mt-2.5 line-clamp-2 font-headings text-lg font-semibold leading-snug tracking-tight">
                  <Link
                    href={href}
                    className="outline-none underline-offset-4 transition-colors hover:text-primary focus-visible:text-primary focus-visible:underline"
                  >
                    {title}
                  </Link>
                </h3>

                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                  {brief.description}
                </p>

                {tags.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex h-5 items-center rounded-md border border-hairline px-2 text-[11px] text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hairline pt-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                    <Wallet className="size-3.5 text-primary" aria-hidden="true" />
                    {formatFCFA(brief.budget)}
                  </span>
                  {st ? (
                    <>
                      {st.offers > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="size-3.5" aria-hidden="true" />
                          {isEn
                            ? `${st.offers} offer${st.offers === 1 ? "" : "s"}`
                            : `${st.offers} offre${st.offers > 1 ? "s" : ""}`}
                        </span>
                      ) : null}
                      {st.views > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <Eye className="size-3.5" aria-hidden="true" />
                          {isEn
                            ? `${st.views} view${st.views === 1 ? "" : "s"}`
                            : `${st.views} vue${st.views > 1 ? "s" : ""}`}
                        </span>
                      ) : null}
                    </>
                  ) : null}
                  <Link
                    href={href}
                    className="ml-auto inline-flex min-h-9 items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold text-primary outline-none transition-colors hover:text-primary-light focus-visible:ring-2 focus-visible:ring-primary/50"
                    aria-label={`${labels.viewProject} — ${title}`}
                  >
                    {labels.viewProject}
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="mt-10 flex justify-center">
        <Link
          href="/briefs"
          className="btn-shine inline-flex min-h-11 items-center gap-2 rounded-full border border-primary/30 bg-primary-soft px-6 py-2.5 text-sm font-semibold text-primary transition-colors outline-none hover:border-primary/60 hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          {labels.cta}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

function clientInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "DM"
  );
}

function relativeTime(isoDate: string, locale: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / 60000));
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (minutes < 60) return formatter.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return formatter.format(-hours, "hour");
  const days = Math.floor(hours / 24);
  return formatter.format(-days, "day");
}

function firstLine(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const dot = clean.indexOf(".");
  const sentence = dot > 20 ? clean.slice(0, dot) : clean;
  return sentence.length > 72 ? sentence.slice(0, 72) + "…" : sentence;
}
