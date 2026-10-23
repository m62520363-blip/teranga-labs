"use client";

import React from "react";
import {
  CheckCircle2,
  LifeBuoy,
  Loader2,
  Lock,
  MessageSquare,
  Plus,
  Send,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "cn";

type Ticket = {
  id: string;
  subject: string;
  status: "open" | "answered" | "closed";
  created_at: string;
};

type TicketMessage = {
  id: string;
  is_staff: boolean;
  body: string;
  created_at: string;
};

const STATUS_LABEL: Record<Ticket["status"], string> = {
  open: "En attente",
  answered: "Répondu",
  closed: "Fermé",
};

function friendlyRpcError(error: unknown): string {
  const message =
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : "";
  return message || "Une erreur est survenue, réessayez.";
}

export default function SupportTickets() {
  const [tickets, setTickets] = React.useState<Ticket[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [form, setForm] = React.useState({ subject: "", body: "" });
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<TicketMessage[]>([]);
  const [threadLoading, setThreadLoading] = React.useState(false);
  const [reply, setReply] = React.useState("");

  const supabase = React.useMemo(() => createClient(), []);

  const refresh = React.useCallback(async () => {
    const { data } = await supabase
      .from("support_tickets")
      .select("id, subject, status, created_at")
      .order("created_at", { ascending: false });
    setTickets((data as Ticket[]) ?? []);
  }, [supabase]);

  React.useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const openThread = React.useCallback(
    async (ticketId: string) => {
      setOpenId(ticketId);
      setThreadLoading(true);
      setError("");
      const { data } = await supabase
        .from("support_messages")
        .select("id, is_staff, body, created_at")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      setMessages((data as TicketMessage[]) ?? []);
      setThreadLoading(false);
    },
    [supabase],
  );

  const createTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const subject = form.subject.trim();
    const body = form.body.trim();
    if (subject.length < 5) {
      setError("Le sujet doit faire au moins 5 caractères.");
      return;
    }
    if (body.length < 10) {
      setError("Décrivez votre besoin en 10 caractères minimum.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    const { data, error: err } = await supabase.rpc("create_support_ticket", {
      p_subject: subject,
      p_body: body,
    });
    setBusy(false);
    if (err) {
      setError(friendlyRpcError(err));
      return;
    }
    const created = data as { id?: string } | null;
    setNotice("Ticket créé. Notre équipe vous répond ici.");
    setForm({ subject: "", body: "" });
    await refresh();
    if (created?.id) await openThread(created.id);
  };

  const sendReply = async () => {
    if (!openId) return;
    const body = reply.trim();
    if (body.length < 2) {
      setError("Message trop court.");
      return;
    }
    setBusy(true);
    setError("");
    const { error: err } = await supabase.rpc("reply_support_ticket", {
      p_ticket_id: openId,
      p_body: body,
    });
    setBusy(false);
    if (err) {
      setError(friendlyRpcError(err));
      return;
    }
    setReply("");
    await openThread(openId);
    await refresh();
  };

  const closeTicket = async (ticketId: string) => {
    setBusy(true);
    setError("");
    const { error: err } = await supabase.rpc("close_support_ticket", {
      p_ticket_id: ticketId,
    });
    setBusy(false);
    if (err) {
      setError(friendlyRpcError(err));
      return;
    }
    if (openId === ticketId) setOpenId(null);
    await refresh();
  };

  return (
    <div className="space-y-6">
      {/* Formulaire nouveau ticket */}
      <form onSubmit={createTicket} className="rounded-xl border border-hairline bg-surface p-5">
        <div className="flex items-center gap-2">
          <LifeBuoy className="size-4 text-primary" aria-hidden="true" />
          <h2 className="font-display text-base font-semibold">Ouvrir un ticket</h2>
        </div>
        <div className="mt-4 space-y-3">
          <Input
            value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            placeholder="Sujet (5 caractères minimum)"
            maxLength={120}
            aria-label="Sujet du ticket"
          />
          <Textarea
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            placeholder="Décrivez votre problème ou votre question (10 caractères minimum)"
            rows={4}
            maxLength={4000}
            aria-label="Message"
          />
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
            Créer le ticket
          </Button>
        </div>
      </form>

      {/* Liste des tickets */}
      <div className="rounded-xl border border-hairline bg-surface p-5">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-primary" aria-hidden="true" />
          <h2 className="font-display text-base font-semibold">Mes tickets</h2>
        </div>

        {loading ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Chargement…
          </p>
        ) : tickets.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Aucun ticket pour l&apos;instant. Ouvrez-en un ci-dessus si vous avez besoin d&apos;aide.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-hairline">
            {tickets.map((ticket) => (
              <li key={ticket.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => (openId === ticket.id ? setOpenId(null) : openThread(ticket.id))}
                    className="text-left text-sm font-medium outline-none hover:text-primary focus-visible:text-primary"
                  >
                    {ticket.subject}
                  </button>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={cn(
                        ticket.status === "open" && "text-amber-500",
                        ticket.status === "answered" && "text-primary",
                        ticket.status === "closed" && "text-muted-foreground",
                      )}
                    >
                      {STATUS_LABEL[ticket.status]}
                    </Badge>
                    {ticket.status !== "closed" && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => closeTicket(ticket.id)}
                        aria-label="Fermer le ticket"
                      >
                        <X className="size-4" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </div>

                {openId === ticket.id && (
                  <div className="mt-3 space-y-2">
                    {threadLoading ? (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        Chargement de la conversation…
                      </p>
                    ) : (
                      <>
                        {messages.map((m) => (
                          <div
                            key={m.id}
                            className={cn(
                              "rounded-lg px-3 py-2 text-sm",
                              m.is_staff
                                ? "bg-primary/10 text-foreground"
                                : "bg-muted text-foreground",
                            )}
                          >
                            <span className="text-xs font-semibold text-muted-foreground">
                              {m.is_staff ? "Équipe Devmarket" : "Vous"} ·{" "}
                              {new Date(m.created_at).toLocaleDateString("fr-FR")}
                            </span>
                            <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                          </div>
                        ))}
                        {ticket.status !== "closed" && (
                          <div className="flex items-start gap-2">
                            <Textarea
                              value={reply}
                              onChange={(e) => setReply(e.target.value)}
                              placeholder="Répondre…"
                              rows={2}
                              maxLength={4000}
                              aria-label="Réponse au ticket"
                            />
                            <Button
                              type="button"
                              size="sm"
                              disabled={busy}
                              onClick={sendReply}
                              aria-label="Envoyer la réponse"
                            >
                              <Send className="size-4" aria-hidden="true" />
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="flex items-center gap-2 text-sm text-primary">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          {notice}
        </p>
      )}
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="size-3.5" aria-hidden="true" />
        Vos tickets sont privés : seuls vous et l&apos;équipe Devmarket y ont accès.
      </p>
    </div>
  );
}