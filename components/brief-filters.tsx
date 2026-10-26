"use client"

import * as React from "react"
import { Loader2, Search } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { CountryRegionSelect } from "@/components/ui/CountryRegionSelect"
import { BriefCard } from "@/components/brief-card"
import { BriefGrid } from "@/components/brief-grid"
import { UnlockDialog } from "@/components/unlock-dialog"
import { ReportButton } from "@/components/report-button"
import { FavoriteButton } from "@/components/favorite-button"
import { EmptyState } from "@/components/empty-state"
import { createClient } from "@/lib/supabase/client"
import { BRIEFS_COLUMNS, BRIEFS_PAGE_SIZE, isBriefSponsored } from "@/lib/briefs-pagination"
import type { PublicRequest, PublicRequestWithSponsor } from "@/types/database"
import { PROJECT_TYPE_LABELS } from "@/lib/tokens"
import { countryCodeForPlace, findRegionByPlace } from "@/lib/geography"

type UnlockInfo = Record<string, { conversation_id?: string; whatsapp?: string }>;

type BudgetBand = {
  value: string;
  label: string;
  matches: (budget: number) => boolean;
};

const BUDGET_BANDS: BudgetBand[] = [
  { value: "all", label: "Tous les budgets", matches: () => true },
  { value: "lt-100k", label: "Moins de 100 000 F", matches: (b) => b < 100000 },
  { value: "100k-300k", label: "100 000 – 300 000 F", matches: (b) => b >= 100000 && b <= 300000 },
  { value: "gt-300k", label: "Plus de 300 000 F", matches: (b) => b > 300000 },
];

export function BriefFilters({
  briefs,
  total,
  user,
  balance,
  unlocks,
  favorites = new Set<string>(),
  initialCountry = "",
  initialRegion = "",
  welcomeContactFree = false,
}: {
  briefs: PublicRequest[];
  total: number;
  user: { id: string } | null;
  balance: number | null;
  unlocks: UnlockInfo;
  favorites?: Set<string>;
  initialCountry?: string;
  initialRegion?: string;
  welcomeContactFree?: boolean;
}) {
  const [all, setAll] = React.useState<PublicRequestWithSponsor[]>(
    briefs as PublicRequestWithSponsor[]
  );
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [city, setCity] = React.useState("all");
  const [type, setType] = React.useState("all");
  const [budget, setBudget] = React.useState("all");
  const [country, setCountry] = React.useState(initialCountry)
  const [region, setRegion] = React.useState(initialRegion)

  const knownTotal = Math.max(total, all.length);
  const hasMore = all.length < knownTotal;

  const loadMore = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("requests")
        .select(BRIEFS_COLUMNS)
        .eq("status", "ouvert")
        .eq("hidden", false)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(all.length, all.length + BRIEFS_PAGE_SIZE - 1);
      if (error) throw error;
      const rows = (data ?? []) as PublicRequestWithSponsor[];
      setAll((prev) => {
        const seen = new Set(prev.map((b) => b.id));
        return [...prev, ...rows.filter((b) => !seen.has(b.id))];
      });
    } catch {
      setLoadError("Impossible de charger d'autres projets. Réessayez dans un instant.");
    } finally {
      setLoading(false);
    }
  }, [all.length]);

  const budgetBand = React.useMemo(
    () => BUDGET_BANDS.find((b) => b.value === budget) ?? BUDGET_BANDS[0],
    [budget]
  );

  // Villes réellement présentes dans les briefs chargés (jamais inventées).
  const cityItems = React.useMemo(() => {
    const items: Record<string, string> = { all: "Toutes les villes" };
    const seen = new Set<string>();
    for (const b of all) {
      const c = b.client_city?.trim();
      if (c && !seen.has(c)) {
        seen.add(c);
        items[c] = c;
      }
    }
    return items;
  }, [all]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const selectedRegion = region ? findRegionByPlace(region) : null;
    return all.filter((brief) => {
      const label = PROJECT_TYPE_LABELS[brief.project_type] ?? brief.project_type;
      const haystack = `${label} ${brief.client_city} ${brief.description ?? ""}`.toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (city !== "all" && brief.client_city?.trim() !== city) return false;
      if (country && country !== "all") {
        const match = countryCodeForPlace(brief.client_city);
        if (!match || match.toUpperCase() !== country.toUpperCase()) return false;
      }
      if (selectedRegion) {
        const regionMatch = findRegionByPlace(brief.client_city);
        if (!regionMatch || regionMatch.code !== selectedRegion.code) return false;
      }
      if (type !== "all" && brief.project_type !== type) return false;
      if (!budgetBand.matches(brief.budget)) return false;
      return true;
    }).sort((a, b) => {
      const aS = isBriefSponsored(a) ? 0 : 1;
      const bS = isBriefSponsored(b) ? 0 : 1;
      return aS - bS;
    });
  }, [all, query, city, type, country, region, budgetBand]);

  const typeItems = React.useMemo(() => {
    const items: Record<string, string> = { all: "Tous les types" };
    return items;
  }, []);

  const budgetItems = React.useMemo(() => {
    const items: Record<string, string> = {};
    for (const band of BUDGET_BANDS) items[band.value] = band.label;
    return items;
  }, []);

  return (
    <div>
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher par mots-clés : e-commerce, Dakar, WordPress…"
            className="h-10 rounded-xl pl-9"
            aria-label="Rechercher dans les projets"
          />
        </div>
        <div className="mt-2">
          <CountryRegionSelect country={country || null} region={region || null} onCountryChange={(c)=>setCountry(c||"")} onRegionChange={(r)=>setRegion(r||"")} showAllOption={true} />
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={city} onValueChange={(v) => setCity(v ?? "all")} items={cityItems}>
            <SelectTrigger size="default" className="w-full rounded-xl sm:w-auto" aria-label="Filtrer par ville">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              {Object.entries(cityItems).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={type} onValueChange={(v) => setType(v ?? "all")} items={typeItems}>
            <SelectTrigger size="default" className="w-full rounded-xl sm:w-auto" aria-label="Filtrer par type de projet">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              {Object.entries(typeItems).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={budget} onValueChange={(v) => setBudget(v ?? "all")} items={budgetItems}>
            <SelectTrigger size="default" className="w-full rounded-xl sm:w-auto" aria-label="Filtrer par budget">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              {Object.entries(budgetItems).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="mt-6 text-sm font-medium text-muted-foreground">
        {filtered.length} projet{filtered.length > 1 ? "s" : ""} disponible
        {filtered.length > 1 ? "s" : ""} sur le marketplace
        {hasMore ? (
          <span className="font-normal">
            {" "}
            · {knownTotal} au total, affinez vos filtres ou affichez-en plus
          </span>
        ) : null}
      </p>

      <BriefGrid className="mt-6">
        {filtered.map((brief) => (
          <BriefCard
            key={brief.id}
            brief={brief}
            sponsored={isBriefSponsored(brief)}
            footer={
              <div className="flex flex-wrap items-center gap-1">
                {user ? (
                  <FavoriteButton
                    briefId={brief.id}
                    initialFavorite={favorites.has(brief.id)}
                  />
                ) : null}
                <ReportButton targetType="brief" targetId={brief.id} />
                <UnlockDialog
                  brief={brief}
                  user={user}
                  balance={balance}
                  conversationId={unlocks[brief.id]?.conversation_id ?? null}
                  welcomeFree={welcomeContactFree}
                />
              </div>
            }
          />
        ))}
      </BriefGrid>

      {filtered.length === 0 && (
        <div className="mt-6">
          <EmptyState
            title="Aucun projet ne correspond à ces critères"
            description="Modifiez vos filtres ou revenez plus tard : de nouveaux projets sont publiés régulièrement."
          />
        </div>
      )}

      {hasMore && (
        <div className="mt-10 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-hairline bg-card px-5 text-sm font-medium text-foreground transition-colors hover:border-border-strong hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {loading ? "Chargement…" : "Afficher plus de projets"}
          </button>
          <p className="text-xs text-muted-foreground">
            {all.length} sur {knownTotal} projet{knownTotal > 1 ? "s" : ""} chargé
            {all.length > 1 ? "s" : ""}
          </p>
          {loadError ? (
            <p role="alert" className="text-xs text-error">
              {loadError}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}




