import type { ReactNode } from "react";
import Link from "next/link";
import { BadgeCheck, MapPin, Sparkles, Timer } from "lucide-react";
import type { PublicRequest } from "@/types/database";
import { formatFCFA, formatRelativeTime, briefFreshness } from "@/lib/formatting";
import { PROJECT_TYPE_LABELS } from "@/lib/tokens";
import { cn } from "cn";

export function BriefCard({
  brief,
  footer,
  compact = false,
}: {
  brief: PublicRequest;
  footer?: ReactNode;
  compact?: boolean;
}) {
  const freshness = briefFreshness(brief.created_at);

  return (
    <article
      className={cn(
        "group flex h-full flex-col rounded-2xl border border-[#2A2A2A] bg-[#141414] p-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#E86A2C]/30 hover:shadow-md",
        compact && "p-5"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex h-5 items-center rounded-full bg-[#1E1E1E] px-2.5 text-[11px] font-semibold uppercase tracking-wide text-foreground">
          {PROJECT_TYPE_LABELS[brief.project_type] ?? brief.project_type}
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <MapPin className="size-3.5" aria-hidden="true" />
          {brief.client_city}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {brief.demo ? (
          <span className="inline-flex h-5 items-center rounded-full border border-[#E86A2C]/40 bg-[#2A1A10] px-2.5 text-[11px] font-semibold text-[#E86A2C]">
            Exemple
          </span>
        ) : null}
        {freshness === "h24" ? (
          <span className="inline-flex h-5 items-center gap-1 rounded-full bg-[#2A1A10] px-2.5 text-[11px] font-semibold text-[#E86A2C]">
            <Timer className="size-3" aria-hidden="true" />
            Moins de 24h
          </span>
        ) : null}
        {freshness === "new" ? (
          <span className="inline-flex h-5 items-center gap-1 rounded-full bg-[#122A1C] px-2.5 text-[11px] font-semibold text-[#3DD68C]">
            <Sparkles className="size-3" aria-hidden="true" />
            Nouveau
          </span>
        ) : null}
        {brief.budget_verified ? (
          <span className="inline-flex h-5 items-center gap-1 rounded-full border border-[#3DD68C]/25 bg-[#141414] px-2.5 text-[11px] font-semibold text-[#3DD68C]">
            <BadgeCheck className="size-3" aria-hidden="true" />
            Budget vérifié
          </span>
        ) : null}
      </div>

      <h3 className="mt-3 text-lg font-semibold leading-snug tracking-tight">
        <Link
          href={`/briefs/${brief.id}`}
          className="outline-none underline-offset-4 hover:text-[#E86A2C] focus-visible:underline"
        >
          {brief.client_name}
        </Link>
      </h3>

      <p className="mt-1.5 text-lg font-semibold tracking-tight">
        {formatFCFA(brief.budget)}
      </p>

      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
        {brief.description}
      </p>

      <div className="min-h-6 grow" aria-hidden="true" />

      <div className="flex items-center justify-between gap-3 border-t border-[#2A2A2A] pt-4">
        <span className="text-xs text-muted-foreground">
          {formatRelativeTime(brief.created_at)}
        </span>
        <div className="flex items-center">{footer}</div>
      </div>
    </article>
  );
}