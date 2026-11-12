"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellRing,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/formatting";
import { notificationIcon } from "@/lib/notification-icon";
import { cn } from "cn";

export type InAppNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read: boolean;
  created_at: string;
};

export function NotificationBell({ userId }: { userId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<InAppNotification[]>([]);
  const [unread, setUnread] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [channelKey] = React.useState(() =>
    Math.random().toString(36).slice(2, 10)
  );

  const refresh = React.useCallback(async () => {
    const supabase = createClient();
    const [listRes, countRes] = await Promise.all([
      supabase.rpc("my_notifications", { p_limit: 25 }),
      supabase.rpc("notifications_unread_count"),
    ]);
    if (Array.isArray(listRes.data)) {
      setItems(listRes.data as InAppNotification[]);
    }
    if (typeof countRes.data === "number") setUnread(countRes.data);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    (async () => {
      const [listRes, countRes] = await Promise.all([
        supabase.rpc("my_notifications", { p_limit: 25 }),
        supabase.rpc("notifications_unread_count"),
      ]);
      if (!mounted) return;
      if (Array.isArray(listRes.data)) setItems(listRes.data as InAppNotification[]);
      if (typeof countRes.data === "number") setUnread(countRes.data);
      setLoading(false);
    })();

    const channel = supabase.channel(`notifications-${userId}-${channelKey}`);
    try {
      channel
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
            setItems((prev) => [row, ...prev].slice(0, 50));
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
    } catch {
      // Realtime indisponible : les notifications restent accessibles via refresh.
    }

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [userId, refresh, channelKey]);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const markRead = async (ids: string[]) => {
    if (ids.length === 0) return;
    const supabase = createClient();
    await supabase.rpc("mark_notifications_read", { p_ids: JSON.stringify(ids) });
    setItems((prev) =>
      prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n))
    );
    setUnread((u) => Math.max(0, u - ids.length));
  };

  const openItem = (item: InAppNotification) => {
    if (!item.read) void markRead([item.id]);
    setOpen(false);
    if (item.link) router.push(item.link);
  };

  const markAll = async () => {
    const unreadItems = items.filter((n) => !n.read).map((n) => n.id);
    if (unreadItems.length === 0) return;
    const supabase = createClient();
    await supabase.rpc("mark_all_notifications_read");
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void refresh();
        }}
        aria-label={
          unread > 0
            ? `Notifications, ${unread} non lues`
            : "Notifications, aucune nouvelle"
        }
        aria-expanded={open}
        className="relative inline-flex size-9 items-center justify-center rounded-lg text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        {unread > 0 ? (
          <BellRing className="size-5 text-primary" aria-hidden="true" />
        ) : (
          <Bell className="size-5" aria-hidden="true" />
        )}
        {unread > 0 ? (
          <span className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-ink">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-2xl border border-hairline bg-surface shadow-2xl shadow-black/60 sm:w-96">
          <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
            <p className="text-sm font-semibold tracking-tight">
              Notifications
              {unread > 0 ? (
                <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary-light">
                  {unread} nouvelle{unread > 1 ? "s" : ""}
                </span>
              ) : null}
            </p>
            {unread > 0 ? (
              <button
                type="button"
                onClick={markAll}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                Tout marquer lu
              </button>
            ) : null}
          </div>

          <div className="max-h-[26rem] overflow-y-auto" role="menu">
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Chargement…
              </div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Aucune notification pour le moment.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Nouveaux messages, devis acceptés et briefs débloqués
                  apparaîtront ici.
                </p>
              </div>
            ) : (
              <ul>
                {items.map((item) => {
                  const Icon = notificationIcon(item.type);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => openItem(item)}
                        role="menuitem"
                        className={cn(
                          "flex w-full items-start gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-muted focus-visible:bg-muted",
                          !item.read && "bg-primary-soft"
                        )}
                      >
                        <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
                          <Icon className="size-4 text-primary" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1 overflow-visible">
                          <span className="flex items-center justify-between gap-2">
                            <span className="break-words text-sm font-medium whitespace-normal">
                              {item.title}
                            </span>
                            {!item.read ? (
                              <span
                                className="size-2 shrink-0 rounded-full bg-primary"
                                aria-label="Non lu"
                              />
                            ) : null}
                          </span>
                          {item.body ? (
                            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground break-words whitespace-normal">
                              {item.body}
                            </span>
                          ) : null}
                          <span className="mt-1 block text-[11px] text-muted-foreground">
                            {formatRelativeTime(item.created_at)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-hairline p-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push("/notifications");
              }}
              className="w-full rounded-lg px-3 py-2 text-center text-sm font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              Voir tout l&apos;historique
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}