"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, Send, Sparkles, Check, Zap, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatFCFA, formatDateTime } from "@/lib/formatting";
import { missionErrorMessage } from "@/lib/mission-labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "cn";

export type ThreadMessage = {
  id: string;
  sender_id: string | null;
  content: string;
  message_type: "text" | "offer" | "system";
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

export type ThreadOffer = {
  id: string;
  developer_id: string | null;
  total_price_fcfa: number;
  deposit_fcfa: number | null;
  delivery_days: number;
  description: string | null;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
};

type Props = {
  conversationId: string;
  userId: string;
  isClient: boolean;
  otherName: string;
  conversationStatus: "active" | "awarded" | "archived";
  requestStatus: string;
  initialMessages: ThreadMessage[];
  initialOffers: ThreadOffer[];
  hasRequest?: boolean;
  missionId?: string | null;
};

export function MessageThread({
  conversationId,
  userId,
  isClient,
  otherName,
  conversationStatus,
  requestStatus,
  initialMessages,
  initialOffers,
  hasRequest = true,
  missionId = null,
}: Props) {
  const [messages, setMessages] = React.useState<ThreadMessage[]>(initialMessages);
  const [offers, setOffers] = React.useState<ThreadOffer[]>(initialOffers);
  const [draft, setDraft] = React.useState("");
  const [channelKey] = React.useState(() =>
    Math.random().toString(36).slice(2, 10)
  );
  const [sending, setSending] = React.useState(false);
  const [offerOpen, setOfferOpen] = React.useState(false);
  const [offerForm, setOfferForm] = React.useState({
    total: "",
    deposit: "",
    days: "",
    description: "",
  });
  const [offerSending, setOfferSending] = React.useState(false);
  const [creatingMission, setCreatingMission] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const router = useRouter();

  const locked = conversationStatus !== "active";

  const quickReplies = isClient
    ? [
        "Merci pour votre proposition, je l'examine.",
        "Pouvons-nous échanger sur WhatsApp pour affiner le devis ?",
      ]
    : [
        "Bonjour, merci pour votre confiance. Je vous envoie une proposition chiffrée très rapidement.",
        "Je suis disponible pour un échange WhatsApp afin d'affiner votre besoin.",
      ];

  React.useEffect(() => {
    const supabase = createClient();
    void supabase.rpc("mark_entity_notifications_read", {
      p_entity_type: "conversation",
      p_entity_id: conversationId,
    });
  }, [conversationId]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages.length]);

  const markRead = React.useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      const supabase = createClient();
      await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .in("id", ids);
      setMessages((prev) =>
        prev.map((m) => (ids.includes(m.id) && !m.read_at ? { ...m, read_at: new Date().toISOString() } : m))
      );
    },
    []
  );

  React.useEffect(() => {
    const unread = messages
      .filter((m) => m.sender_id !== userId && !m.read_at && m.message_type === "text")
      .map((m) => m.id);
    if (unread.length > 0) void markRead(unread);
  }, [messages, userId, markRead]);

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`room:${conversationId}-${channelKey}`);
    try {
      channel
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const row = payload.new as ThreadMessage;
            setMessages((prev) =>
              prev.some((m) => m.id === row.id) ? prev : [...prev, row]
            );
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const row = payload.new as ThreadMessage;
            setMessages((prev) => prev.map((m) => (m.id === row.id ? row : m)));
          }
        )
        .subscribe();
    } catch {
      // Realtime indisponible : les messages restent accessibles via le fetch initial.
    }

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, channelKey]);

  const sendMessage = async () => {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: userId,
        content,
        message_type: "text",
      });
    setSending(false);
    if (error) {
      toast.error("Envoi impossible. Réessayez.");
      return;
    }
    setDraft("");
  };

  const sendOffer = async () => {
    const total = Number.parseInt(offerForm.total, 10);
    const days = Number.parseInt(offerForm.days, 10);
    if (Number.isNaN(total) || total < 1) {
      toast.error("Indiquez un montant valide.");
      return;
    }
    if (Number.isNaN(days) || days < 1) {
      toast.error("Indiquez un délai valide.");
      return;
    }
    setOfferSending(true);
    const supabase = createClient();
    const { data: offer, error } = await supabase
      .from("formal_offers")
      .insert({
        conversation_id: conversationId,
        developer_id: userId,
        total_price_fcfa: total,
        deposit_fcfa: offerForm.deposit ? Number.parseInt(offerForm.deposit, 10) || null : null,
        delivery_days: days,
        description: offerForm.description.trim() || null,
      })
      .select("id")
      .single();
    if (error || !offer) {
      setOfferSending(false);
      toast.error("Devis non envoyé. Réessayez.");
      return;
    }
    const { error: msgError } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: userId,
      content: "Proposition chiffrée envoyée.",
      message_type: "offer",
      metadata: {
        offer_id: offer.id,
        total_price_fcfa: total,
        deposit_fcfa: offerForm.deposit ? Number.parseInt(offerForm.deposit, 10) || 0 : 0,
        delivery_days: days,
      },
    });
    setOfferSending(false);
    if (msgError) {
      toast.error("Devis envoyé mais message non affiché. Actualisez la page.");
      return;
    }
    setOffers((prev) => [
      ...prev,
      {
        id: offer.id,
        developer_id: userId,
        total_price_fcfa: total,
        deposit_fcfa: offerForm.deposit ? Number.parseInt(offerForm.deposit, 10) || null : null,
        delivery_days: days,
        description: offerForm.description.trim() || null,
        status: "pending",
        created_at: new Date().toISOString(),
      },
    ]);
    setOfferOpen(false);
    setOfferForm({ total: "", deposit: "", days: "", description: "" });
    toast.success("Votre devis a été envoyé.");
  };

  const acceptOffer = async (offerId: string) => {
    const supabase = createClient();
    const { error } = await supabase.rpc("accept_formal_offer", {
      p_offer_id: offerId,
    });
    if (error) {
      toast.error(error.message || "Impossible d’accepter ce devis.");
      return;
    }
    setOffers((prev) => prev.map((o) => (o.id === offerId ? { ...o, status: "accepted" } : o)));
    toast.success("Devis accepté. Le projet démarre !");
    setTimeout(() => router.refresh(), 400);
  };

  const rejectOffer = async (offerId: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("formal_offers")
      .update({ status: "rejected" })
      .eq("id", offerId);
    if (error) {
      toast.error("Impossible de refuser ce devis.");
      return;
    }
    setOffers((prev) => prev.map((o) => (o.id === offerId ? { ...o, status: "rejected" } : o)));
  };

  const awardedOffer = offers.find((o) => o.status === "accepted");

  const startMission = async () => {
    if (!awardedOffer) return;
    setCreatingMission(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("create_mission_from_offer", {
      p_offer_id: awardedOffer.id,
    });
    setCreatingMission(false);
    if (error) {
      toast.error(missionErrorMessage(error.code ?? null, error.message || "Impossible de créer la mission."));
      return;
    }
    toast.success("Mission créée. C'est parti !");
    setTimeout(() => router.refresh(), 350);
  };

  return (
    <div className="flex h-full min-h-[60vh] flex-col overflow-hidden rounded-2xl border border-hairline bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4">
        <div className="min-w-0">
          <p className="truncate font-semibold tracking-tight">{otherName}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {locked ? "Discussion clôturée" : "Discussion en direct"}
          </p>
        </div>
        {locked ? (
          <span className="badge badge-warning">Projet attribué</span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-success">
            <span className="size-2 rounded-full bg-success" aria-hidden="true" />
            Temps réel
          </span>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
        {messages.length === 0 && offers.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Commencez la conversation pour ce projet.
          </p>
        ) : null}

        {offers.map((offer) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            mine={offer.developer_id === userId}
            isClient={isClient}
            canAct={isClient && offer.status === "pending" && conversationStatus === "active"}
            onAccept={() => acceptOffer(offer.id)}
            onReject={() => rejectOffer(offer.id)}
          />
        ))}

        {messages.map((msg) => {
          if (msg.message_type === "offer") return null;
          if (msg.message_type === "system") {
            return (
              <div
                key={msg.id}
                className="flex justify-center"
              >
                <p className="max-w-sm rounded-full border border-hairline bg-muted px-4 py-1.5 text-center text-xs text-muted-foreground">
                  {msg.content}
                </p>
              </div>
            );
          }
          const mine = msg.sender_id === userId;
          return (
            <div key={msg.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
                  mine
                    ? "rounded-br-sm bg-primary text-ink"
                    : "rounded-bl-sm border border-hairline bg-muted"
                )}
              >
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                <p
                  className={cn(
                    "mt-1 text-right text-[10px]",
                    mine ? "text-ink/60" : "text-muted-foreground"
                  )}
                >
                  {formatDateTime(msg.created_at)}
                  {mine ? (
                    <span className="ml-1.5 inline-flex items-center gap-0.5">
                      <Check className="size-3" aria-hidden="true" />
                      {msg.read_at ? "Vu" : "Envoyé"}
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
          );
        })}

        {awardedOffer ? (
          <div className="rounded-2xl border border-success/30 bg-success-soft p-4 text-sm text-success">
            <p className="font-semibold">Projet attribué</p>
            <p className="mt-1 text-xs">
              Le devis de {formatFCFA(awardedOffer.total_price_fcfa)} en{" "}
              {awardedOffer.delivery_days} jour{awardedOffer.delivery_days > 1 ? "s" : ""} a été
              accepté. La discussion est clôturée.
            </p>
            {isClient && !missionId ? (
              <button
                type="button"
                disabled={creatingMission}
                onClick={() => void startMission()}
                className="mt-3 inline-flex h-9 items-center gap-2 rounded-xl bg-success px-4 text-xs font-semibold text-white shadow-sm transition-opacity outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-success/50 disabled:opacity-60"
              >
                {creatingMission ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <ClipboardList className="size-3.5" aria-hidden="true" />
                )}
                {creatingMission ? "Création…" : "Démarrer la mission"}
              </button>
            ) : null}
            {missionId ? (
              <Link
                href={`/missions?focus=${missionId}`}
                className="mt-3 inline-flex h-9 items-center gap-2 rounded-xl bg-success px-4 text-xs font-semibold text-white shadow-sm transition-opacity outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-success/50"
              >
                <ClipboardList className="size-3.5" aria-hidden="true" />
                Suivre la mission
              </Link>
            ) : null}
          </div>
        ) : null}

        <div ref={bottomRef} aria-hidden="true" />
      </div>

      <div className="border-t border-hairline px-5 py-4">
        {locked ? (
          <p className="text-center text-sm text-muted-foreground">
            {requestStatus === "attribué"
              ? "Ce projet a été attribué : échangez désormais par WhatsApp en direct."
              : "Cette conversation est archivée."}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {!isClient && hasRequest ? (
              <Button
                variant="secondary"
                size="sm"
                className="self-start border-primary/30 bg-primary-soft text-primary hover:bg-primary/20"
                onClick={() => setOfferOpen(true)}
              >
                <Sparkles className="size-3.5" aria-hidden="true" />
                Envoyer un devis formel
              </Button>
            ) : null}

            <div className="flex flex-wrap gap-1.5">
              {quickReplies.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setDraft(t)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-xs text-muted-foreground transition-colors outline-none hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <Zap className="size-3 text-primary" aria-hidden="true" />
                  <span className="line-clamp-1">{t}</span>
                </button>
              ))}
            </div>

            <div className="flex items-end gap-2">
              <Textarea
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder={`Écrire à ${otherName}…`}
                className="max-h-32 min-h-10 flex-1 resize-none rounded-xl"
                aria-label="Message"
              />
              <Button
                onClick={sendMessage}
                disabled={sending || !draft.trim()}
                className="h-10 shrink-0"
                aria-label="Envoyer"
              >
                {sending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="size-4" aria-hidden="true" />
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={offerOpen} onOpenChange={setOfferOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Devis formel</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="offer-total">Prix total (FCFA) *</Label>
              <Input
                id="offer-total"
                type="number"
                inputMode="numeric"
                min={1}
                value={offerForm.total}
                onChange={(e) => setOfferForm((f) => ({ ...f, total: e.target.value }))}
                placeholder="Ex. 250000"
                disabled={offerSending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="offer-deposit">Acompte (FCFA, optionnel)</Label>
              <Input
                id="offer-deposit"
                type="number"
                inputMode="numeric"
                min={0}
                value={offerForm.deposit}
                onChange={(e) => setOfferForm((f) => ({ ...f, deposit: e.target.value }))}
                placeholder="Ex. 50000"
                disabled={offerSending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="offer-days">Délai de livraison (jours) *</Label>
              <Input
                id="offer-days"
                type="number"
                inputMode="numeric"
                min={1}
                value={offerForm.days}
                onChange={(e) => setOfferForm((f) => ({ ...f, days: e.target.value }))}
                placeholder="Ex. 21"
                disabled={offerSending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="offer-desc">Description (optionnel)</Label>
              <Textarea
                id="offer-desc"
                rows={3}
                value={offerForm.description}
                onChange={(e) => setOfferForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Ce qui est inclus, étapes, garanties…"
                disabled={offerSending}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose
              disabled={offerSending}
              render={
                <Button variant="outline" type="button">
                  Annuler
                </Button>
              }
            />
            <Button onClick={sendOffer} disabled={offerSending} className="h-9">
              {offerSending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="size-4" aria-hidden="true" />
              )}
              Envoyer le devis
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OfferCard({
  offer,
  mine,
  isClient,
  canAct,
  onAccept,
  onReject,
}: {
  offer: ThreadOffer;
  mine: boolean;
  isClient: boolean;
  canAct: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 shadow-sm",
        offer.status === "accepted"
          ? "border-success/40 bg-success-soft"
          : offer.status === "rejected"
            ? "border-hairline bg-muted opacity-70"
            : "border-primary/30 bg-muted"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Sparkles className={cn("size-3.5", offer.status === "pending" && "text-primary")} aria-hidden="true" />
          Devis formel {mine ? "· vous" : isClient ? "· développeur" : ""}
        </span>
        {offer.status === "pending" ? (
          <span className="badge badge-warning">En attente</span>
        ) : offer.status === "accepted" ? (
          <span className="badge badge-success">Accepté</span>
        ) : (
          <span className="badge badge-muted">Refusé</span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Prix total</p>
          <p className="mt-0.5 font-semibold">{formatFCFA(offer.total_price_fcfa)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Acompte</p>
          <p className="mt-0.5 font-semibold">
            {offer.deposit_fcfa ? formatFCFA(offer.deposit_fcfa) : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Délai</p>
          <p className="mt-0.5 font-semibold">
            {offer.delivery_days} jour{offer.delivery_days > 1 ? "s" : ""}
          </p>
        </div>
      </div>
      {offer.description ? (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{offer.description}</p>
      ) : null}
      {canAct ? (
        <div className="mt-4 flex gap-2">
          <Button onClick={onAccept} size="sm" className="h-8">
            <Check className="size-3.5" aria-hidden="true" />
            Accepter et attribuer le projet
          </Button>
          <Button onClick={onReject} size="sm" variant="outline" className="h-8">
            Refuser
          </Button>
        </div>
      ) : null}
    </div>
  );
}