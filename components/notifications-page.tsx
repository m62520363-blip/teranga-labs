"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  Briefcase,
  CheckCheck,
  CheckCircle2,
  Loader2,
  MessageCircle,
  Star,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { EmptyState } from "@/components/empty-state";
import { formatDateTime } from "@/lib/formatting";
import { cn } from "cn";
import type { InAppNotification } from "@/components/notification-bell";

function bellIcon(type: string) {
  switch (type) {
    case "new_message":
      return MessageCircle;
    case "offer_accepted":
      return CheckCheck;
    case "review_received":
      return Star;
    case "review_requested":
      return Star;
    case "review_responded":
      return MessageCircle;
    case "account_certified":
      return BadgeCheck;
    case "unlock_received":
      return Briefcase;
    default:
      return Bell;
  }
}

export function NotificationsPage({ userId }: { userId: string }) {
  const router = useRouter();
  const [items, setItems] = React.useState<InAppNotification[]>([]);
  const [unread, setUnread] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    const supabase = createClient();
    const [listRes, countRes] = await Promise.all([
      supabase.rpc("my_notifications", { p_limit: 100 }),
      supabase.rpc("notifications_unread_count"),
    ]);
    if (Array.isArray(listRes.data)) setItems(listRes.data as InAppNotification[]);
    if (typeof countRes.data === "number") setUnread(countRes.data);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    (async () => {
      const [listRes, countRes] = await Promise.all([
        supabase.rpc("my_notifications", { p_limit: 100 }),
        supabase.rpc("notifications_unread_count"),
      ]);
      if (!mounted) return;
      if (Array.isArray(listRes.data)) setItems(listRes.data as InAppNotification[]);
      if (typeof countRes.data === "number") setUnread(countRes.data);
      setLoading(false);
    })();

    const channel = supabase
      .channel(`notifications-page-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (!mounted) return;
          const row = payload.new as InAppNotification;
          setItems((prev) => [row, ...prev].slice(0, 200));
          setUnread((u) => u + 1);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        async () => {
          if (!mounted) return;
          await refresh();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  const markAll = async () => {
    const supabase = createClient();
    await supabase.rpc("mark_all_notifications_read");
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  const openItem = (item: InAppNotification) => {
    if (!item.read) {
      void (async () => {
        const supabase = createClient();
        await supabase.rpc("mark_notifications_read", {
          p_ids: JSON.stringify([item.id]),
        });
        setItems((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
        );
        setUnread((u) => Math.max(0, u - 1));
      })();
    }
    if (item.link) router.push(item.link);
  };

  return (
    <div className="bg-[#0F0F0F] py-16 md:py-24">
      <div className="container-tl max-w-2xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Notifications
            </h1>
            <p className="mt-2 text-base text-muted-foreground">
              Messages, devis et alertes de la plateforme.
            </p>
          </div>
          {unread > 0 ? (
            <button
              type="button"
              onClick={markAll}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#2A2A2A] bg-[#141414] px-5 text-sm font-medium text-[#F2F2F2] transition-colors outline-none hover:bg-[#1E1E1E] focus-visible:ring-2 focus-visible:ring-[#E86A2C]/50"
            >
              <CheckCircle2 className="size-4 text-[#E86A2C]" aria-hidden="true" />
              Tout marquer lu
            </button>
          ) : null}
        </div>

        <div className="mt-10">
          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-[#2A2A2A] bg-[#141414] p-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Chargement…
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="Aucune notification"
              description="Les nouveaux messages, devis acceptés et briefs débloqués apparaîtront ici."
              action={
                <Link
                  href="/conversations"
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#F2F2F2] px-5 text-sm font-medium text-[#0D0D0D] transition-colors outline-none hover:bg-[#EBEBEB]"
                >
                  Ouvrir mes discussions
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              }
            />
          ) : (
            <ul className="space-y-3">
              {items.map((item) => {
                const Icon = bellIcon(item.type);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openItem(item)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-2xl border p-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#E86A2C]/50 sm:p-5",
                        item.read
                          ? "border-[#2A2A2A] bg-[#141414] hover:bg-[#171717]"
                          : "border-[#E86A2C]/40 bg-[#1A120B] hover:bg-[#1E160F]"
                      )}
                    >
                      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#2A1A10]">
                        <Icon className="size-5 text-[#E86A2C]" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold tracking-tight">
                            {item.title}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground/70">
                            {formatDateTime(item.created_at)}
                          </span>
                        </span>
                        {item.body ? (
                          <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                            {item.body}
                          </span>
                        ) : null}
                      </span>
                      {!item.read ? (
                        <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-[#E86A2C]" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}