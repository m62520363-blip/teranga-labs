"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import type { ApprovedDeveloper, DirectoryFilters } from "@/types/database";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DirectoryCard } from "@/components/dev/directory-card";
import { EmptyState } from "@/components/empty-state";
import { SORT_OPTIONS, TECH_TAGS } from "@/lib/dev-labels";
import { cn } from "cn";

const PAGE_SIZE = 12;
const MIN_RATINGS = [
  { value: "0", label: "Toutes les notes" },
  { value: "3", label: "3,0 et plus" },
  { value: "4", label: "4,0 et plus" },
  { value: "4.5", label: "4,5 et plus" },
];
const MIN_EXPERIENCES = [
  { value: "0", label: "Toutes les expériences" },
  { value: "1", label: "1 an et plus" },
  { value: "3", label: "3 ans et plus" },
  { value: "5", label: "5 ans et plus" },
  { value: "8", label: "8 ans et plus" },
];

export function DirectoryPage({
  initial,
  initialCity,
  filters,
  contactCost,
  role,
  authed,
}: {
  initial: ApprovedDeveloper[];
  initialCity?: string;
  filters: DirectoryFilters;
  contactCost: number;
  role: string | null;
  authed: boolean;
}) {
  const [items, setItems] = React.useState<ApprovedDeveloper[]>(initial);
  const [query, setQuery] = React.useState("");
  const [specialty, setSpecialty] = React.useState("");
  const [city, setCity] = React.useState(initialCity ?? "");
  const [availability, setAvailability] = React.useState("");
  const [projectType, setProjectType] = React.useState("");
  const [minRating, setMinRating] = React.useState("0");
  const [minExperience, setMinExperience] = React.useState("0");
  const [techs, setTechs] = React.useState<string[]>([]);
  const [verifiedOnly, setVerifiedOnly] = React.useState(false);
  const [sort, setSort] = React.useState("relevance");
  const [offset, setOffset] = React.useState(PAGE_SIZE);
  const [hasMore, setHasMore] = React.useState(initial.length === PAGE_SIZE);
  const [loading, setLoading] = React.useState(false);
  const [showFilters, setShowFilters] = React.useState(false);
  const td = useTranslations("Directory");

  const supabase = React.useMemo(() => createClient(), []);

  const buildParams = React.useCallback(
    (offsetValue: number) => ({
      p_query: query.trim() || undefined,
      p_specialty: specialty || undefined,
      p_technologies: techs.length > 0 ? techs : undefined,
      p_services: undefined,
      p_city: city || undefined,
      p_min_experience: minExperience !== "0" ? Number(minExperience) : undefined,
      p_availability: availability || undefined,
      p_min_rating: minRating !== "0" ? Number(minRating) : undefined,
      p_verified_only: verifiedOnly || undefined,
      p_project_type: projectType || undefined,
      p_sort: sort,
      p_limit: PAGE_SIZE,
      p_offset: offsetValue,
    }),
    [query, specialty, city, availability, projectType, minRating, minExperience, techs, verifiedOnly, sort]
  );

  const refresh = React.useCallback(
    async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("list_approved_developers", buildParams(0));
      const rows = ((data ?? []) as ApprovedDeveloper[]).filter((d) => Boolean(d?.id));
      setItems(rows);
      setOffset(rows.length);
      setHasMore(!error && rows.length === PAGE_SIZE);
      setLoading(false);
    },
    [supabase, buildParams]
  );

  const loadMore = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("list_approved_developers", buildParams(offset));
    const rows = ((data ?? []) as ApprovedDeveloper[]).filter((d) => Boolean(d?.id));
    setItems((prev) => [...prev, ...rows]);
    setOffset((prev) => prev + rows.length);
    setHasMore(!error && rows.length === PAGE_SIZE);
    setLoading(false);
  };

  React.useEffect(() => {
    const t = setTimeout(() => void refresh(), 350);
    return () => clearTimeout(t);
  }, [refresh]);

  const anyFilter =
    Boolean(query.trim()) ||
    Boolean(specialty) ||
    Boolean(city) ||
    Boolean(availability) ||
    Boolean(projectType) ||
    minRating !== "0" ||
    minExperience !== "0" ||
    techs.length > 0 ||
    verifiedOnly;

  const reset = () => {
    setQuery("");
    setSpecialty("");
    setCity("");
    setAvailability("");
    setProjectType("");
    setMinRating("0");
    setMinExperience("0");
    setTechs([]);
    setVerifiedOnly(false);
  };

  const toggleTech = (tag: string) => {
    setTechs((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher par nom, spécialité, compétence ou service…"
              className="h-11 rounded-xl pl-10"
              aria-label="Rechercher un développeur"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-hairline bg-card px-4 text-sm font-medium text-muted-foreground transition-colors outline-none hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-expanded={showFilters}
          >
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            Filtres
            {anyFilter ? (
              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-ink">
                {techs.length + (specialty ? 1 : 0) + (city ? 1 : 0) + (availability ? 1 : 0) + (projectType ? 1 : 0) + (minRating !== "0" ? 1 : 0) + (minExperience !== "0" ? 1 : 0) + (verifiedOnly ? 1 : 0)}
              </span>
            ) : null}
          </button>
        </div>

        {showFilters ? (
          <div className="grid grid-cols-1 gap-3 rounded-2xl border border-hairline bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
            <FilterSelect
              label="Spécialité"
              value={specialty}
              onChange={setSpecialty}
              options={filters.specialties}
              placeholder="Toutes les spécialités"
            />
            <FilterSelect
              label="Ville"
              value={city}
              onChange={setCity}
              options={filters.cities}
              placeholder="Toutes les villes"
            />
            <FilterSelect
              label="Disponibilité"
              value={availability}
              onChange={setAvailability}
              options={["available_now", "available_soon", "on_mission"]}
              optionsLabels={{
                available_now: "Disponible immédiatement",
                available_soon: "Disponible bientôt",
                on_mission: "En mission",
              }}
              placeholder="Toutes les disponibilités"
            />
            <FilterSelect
              label="Type de projet"
              value={projectType}
              onChange={setProjectType}
              options={filters.project_types}
              placeholder="Tous les types"
            />
            <FilterSelect
              label="Note minimum"
              value={minRating}
              onChange={setMinRating}
              options={MIN_RATINGS.map((r) => r.value)}
              optionsLabels={Object.fromEntries(MIN_RATINGS.map((r) => [r.value, r.label]))}
              placeholder="Toutes les notes"
            />
            <FilterSelect
              label="Expérience"
              value={minExperience}
              onChange={setMinExperience}
              options={MIN_EXPERIENCES.map((r) => r.value)}
              optionsLabels={Object.fromEntries(MIN_EXPERIENCES.map((r) => [r.value, r.label]))}
              placeholder="Toutes les expériences"
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Technologies</span>
              <div className="flex flex-wrap gap-1.5">
                {TECH_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTech(tag)}
                    className={cn(
                      "rounded-lg border px-2 py-1 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                      techs.includes(tag)
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-hairline bg-muted text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Options</span>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={verifiedOnly}
                  onChange={(e) => setVerifiedOnly(e.target.checked)}
                  className="size-4 accent-primary"
                />
                Profils vérifiés uniquement
              </label>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {loading && items.length === 0 ? "Chargement…" : `${items.length} développeur${items.length > 1 ? "s" : ""} trouvé${items.length > 1 ? "s" : ""}`}
        </p>
        <div className="flex items-center gap-3">
          {anyFilter ? (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <X className="size-3.5" aria-hidden="true" />
              Réinitialiser
            </button>
          ) : null}
          <Select value={sort} onValueChange={(v) => setSort(v ?? "")}>
            <SelectTrigger aria-label={td("sortLabel")}>
              <SelectValue>{td(`sort.${sort}`)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {td(`sort.${o.value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
          Recherche en cours…
        </div>
      ) : items.length === 0 ? (
        <div className="py-10">
          <EmptyState
            title="Aucun développeur trouvé"
            description="Modifiez ou élargissez vos critères pour découvrir plus de profils."
          />
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-live="polite">
          {items.map((dev) => (
            <li key={dev.id} className="h-full">
              <DirectoryCard
                developer={dev}
                contactCost={contactCost}
                role={role}
                authed={authed}
              />
            </li>
          ))}
        </ul>

          {hasMore ? (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loading}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-hairline bg-card px-6 text-sm font-medium transition-colors outline-none hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                Charger d’autres profils
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  optionsLabels,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  optionsLabels?: Record<string, string>;
  placeholder: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={(v) => onChange(v ?? "")}>
        <SelectTrigger className="w-full" aria-label={label}>
          <SelectValue>
            {value ? (optionsLabels?.[value] ?? value) : <span className="text-muted-foreground">{placeholder}</span>}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">{placeholder}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {optionsLabels?.[o] ?? o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}