"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, MessageCircle, Search } from "lucide-react";
import type { ConversationListItem } from "@/lib/conversations";
import { formatFCFA, formatRelativeTime } from "@/lib/formatting";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { cn } from "cn";

export function ConversationsList({
  conversations,
  userId,
}: {
  conversations: ConversationListItem[];
  userId: string;
}) {
  const [query, setQuery] = React.useState("");

  const filtered = conversations.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const haystack =
      `${c.otherName} ${c.subtitle} ${c.request.client_name} ${c.request.client_city} ${c.request.project_type} ${formatFCFA(c.request.budget)} ${c.lastMessage?.content ?? ""}`.toLowerCase();
    return haystack.includes(q);
  });

  return (
    <>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une conversation (nom, ville, projet, budget…)"
          className="h-11 rounded-xl pl-10"
          aria-label="Rechercher une discussion"
        />
      </div>
      {query.trim() && filtered.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Aucune discussion trouvée"
            description="Modifiez votre recherche pour retrouver un échange."
          />
        </div>
      ) : null}
      {query.trim() === "" && conversations.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Aucune discussion pour le moment"
            description="Envoyez une proposition sur un projet pour ouvrir une discussion et recevoir vos premières propositions ici."
            action={
              <Link
                href="/briefs"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-ink transition-colors outline-none hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                Voir les briefs
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            }
          />
        </div>
      ) : null}
      {filtered.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {filtered.map((c) => (
            <li key={c.id}>
              <Link
                href={`/conversations/${c.id}`}
                className={cn(
                  "flex items-center gap-4 rounded-2xl border p-4 transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/50 sm:p-5",
                  c.unreadCount > 0
                    ? "border-primary/30 bg-primary-soft"
                    : "border-hairline bg-card"
                )}
              >
                <div
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-xl",
                    c.unreadCount > 0
                      ? "bg-primary text-ink"
                      : "bg-hairline text-foreground"
                  )}
                  aria-hidden="true"
                >
                  <MessageCircle className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-1">
                    <p className="truncate text-sm font-semibold">{c.otherName}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.last_message_at || c.created_at
                        ? formatRelativeTime(c.last_message_at || c.created_at)
                        : ""}
                    </p>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {c.subtitle}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    {c.pendingOffers > 0 ? (
                      <span className="badge badge-warning">
                        {c.pendingOffers} devis à examiner
                      </span>
                    ) : null}
                    {c.status === "awarded" ? (
                      <span className="badge badge-success">Attribué</span>
                    ) : c.status === "archived" ? (
                      <span className="badge badge-muted">Archivé</span>
                    ) : null}
                    <p className="truncate text-xs text-muted-foreground">
                      {c.lastMessage
                        ? (c.lastMessage.sender_id === userId ? "Vous : " : "") +
                          (c.lastMessage.deleted_at
                            ? "Message supprimé"
                            : c.lastMessage.message_type === "audio"
                              ? "Message vocal"
                              : c.lastMessage.content.length > 50
                                ? c.lastMessage.content.slice(0, 50) + "…"
                                : c.lastMessage.content)
                        : "Démarrez la discussion"}
                    </p>
                  </div>
                </div>
                {c.unreadCount > 0 ? (
                  <span className="ml-2 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-ink">
                    {c.unreadCount}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}