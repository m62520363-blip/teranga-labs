"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FaqItem } from "@/components/faq-item";

export type FaqEntry = {
  q: string;
  a: string;
};

export function FaqSearchableList({
  items,
  placeholder,
  ariaLabel,
  emptyLabel,
}: {
  items: FaqEntry[];
  placeholder: string;
  ariaLabel: string;
  emptyLabel: string;
}) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)
    );
  }, [items, query]);

  return (
    <div>
      <div className="relative mb-6">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className="h-11 rounded-xl pl-10"
        />
      </div>

      <div className="rounded-2xl border border-hairline bg-card p-6 sm:p-8">
        {filtered.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </p>
        ) : (
          filtered.map((f) => (
            <FaqItem key={f.q} question={f.q} answer={f.a} />
          ))
        )}
      </div>
    </div>
  );
}
