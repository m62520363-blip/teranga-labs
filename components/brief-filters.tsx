"use client";

import * as React from "react";
import { Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { BriefCard } from "@/components/brief-card";
import { BriefGrid } from "@/components/brief-grid";
import { UnlockDialog } from "@/components/unlock-dialog";
import { ReportButton } from "@/components/report-button";
import { EmptyState } from "@/components/empty-state";
import type { PublicRequest } from "@/types/database";
import { PROJECT_TYPES, PROJECT_TYPE_LABELS, SENEGAL_REGIONS } from "@/lib/tokens";

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
  user,
  balance,
  unlocks,
}: {
  briefs: PublicRequest[];
  user: { id: string } | null;
  balance: number | null;
  unlocks: UnlockInfo;
}) {
  const [query, setQuery] = React.useState("");
  const [city, setCity] = React.useState("all");
  const [type, setType] = React.useState("all");
  const [budget, setBudget] = React.useState("all");

  const budgetBand = React.useMemo(
    () => BUDGET_BANDS.find((b) => b.value === budget) ?? BUDGET_BANDS[0],
    [budget]
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return briefs.filter((brief) => {
      if (q) {
        const label = PROJECT_TYPE_LABELS[brief.project_type] ?? brief.project_type;
        const haystack = `${brief.client_name} ${brief.description} ${brief.client_city} ${brief.project_type} ${label}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (city !== "all" && brief.client_city !== city) return false;
      if (type !== "all" && brief.project_type !== type) return false;
      if (!budgetBand.matches(brief.budget)) return false;
      return true;
    });
  }, [briefs, query, city, type, budgetBand]);

  const cityItems = React.useMemo(() => {
    const items: Record<string, string> = { all: "Toutes les régions" };
    for (const c of SENEGAL_REGIONS) items[c] = c;
    return items;
  }, []);

  const typeItems = React.useMemo(() => {
    const items: Record<string, string> = { all: "Tous les types" };
    for (const t of PROJECT_TYPES) items[t] = PROJECT_TYPE_LABELS[t];
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
            aria-label="Rechercher dans les briefs"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={city} onValueChange={(v) => setCity(v ?? "all")} items={cityItems}>
            <SelectTrigger size="default" className="w-full rounded-xl sm:w-auto" aria-label="Filtrer par région">
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
        {filtered.length} brief{filtered.length > 1 ? "s" : ""} disponible
        {filtered.length > 1 ? "s" : ""} au Sénégal
      </p>

      <BriefGrid className="mt-6">
        {filtered.map((brief) => (
          <BriefCard
            key={brief.id}
            brief={brief}
            footer={
              <div className="flex items-center gap-1">
                <ReportButton targetType="brief" targetId={brief.id} />
                <UnlockDialog
                  brief={brief}
                  user={user}
                  balance={balance}
                  conversationId={unlocks[brief.id]?.conversation_id ?? null}
                />
              </div>
            }
          />
        ))}
      </BriefGrid>

      {filtered.length === 0 && (
        <div className="mt-6">
          <EmptyState
            title="Aucun brief ne correspond à ces critères"
            description="Modifiez vos filtres ou revenez plus tard : de nouveaux projets sont publiés régulièrement."
          />
        </div>
      )}
    </div>
  );
}