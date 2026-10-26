"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Coins, Loader2, Lock, MessageCircle, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "cn";

export type ContactableDeveloper = {
  id: string;
  username: string | null;
  full_name: string | null;
  professional_title: string | null;
  main_specialty: string | null;
  city?: string | null;
};

type Props = {
  developer: ContactableDeveloper;
  contactCost: number;
  role: string | null;
  authed: boolean;
  label?: string;
  className?: string;
};

type Screen =
  | { kind: "gated" }
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "insufficient" }
  | { kind: "already-open"; conversationId: string };

export function ContactButton({
  developer,
  contactCost,
  role,
  authed,
  label,
  className,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [screen, setScreen] = React.useState<Screen>({ kind: "gated" });
  const [balance, setBalance] = React.useState<number | null>(null);
  const [cost, setCost] = React.useState(contactCost);
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const trackedClick = React.useRef(false);

  const refresh = async () => {
    const supabase = createClient();
    const [bal, cst] = await Promise.all([
      supabase.rpc("get_token_balance"),
      supabase.rpc("get_contact_cost"),
    ]);
    const nextCost = typeof cst.data === "number" ? cst.data : contactCost;
    const nextBalance = typeof bal.data === "number" ? bal.data : 0;
    setCost(nextCost);
    setBalance(nextBalance);
    setScreen(nextBalance >= nextCost ? { kind: "ready" } : { kind: "insufficient" });
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      if (authed && !trackedClick.current) {
        trackedClick.current = true;
        void fetch("/api/analytics/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "contact_click",
            developer_id: developer.id,
          }),
          keepalive: true,
        }).catch(() => {
          // Suivi best-effort uniquement.
        });
      }
      setMessage("");
      setBusy(false);
      if (!authed) {
        setScreen({ kind: "gated" });
        return;
      }
      if (role !== "client") {
        setScreen({ kind: "gated" });
        return;
      }
      setScreen({ kind: "loading" });
      void refresh();
    }
  };

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("contact_developer", {
      p_developer_id: developer.id,
      p_initial_message: message.trim() || null,
    });
    setBusy(false);
    if (error) {
      const code = (error as { code?: string }).code;
      if (code === "TLLOW") {
        setScreen({ kind: "insufficient" });
        toast.error("Votre solde ne permet pas d’ouvrir ce contact.");
        return;
      }
      if (code === "TLRJC") {
        setScreen({ kind: "gated" });
        toast.error(error.message || "Ce profil n’est pas disponible au contact.");
        return;
      }
      if (code === "TLNAU") {
        setScreen({ kind: "gated" });
        toast.error("Connectez-vous pour contacter un développeur.");
        return;
      }
      toast.error(error.message || "Contact impossible, réessayez.");
      return;
    }
    const result = (data ?? {}) as {
      conversation_id?: string;
      first_contact?: boolean;
      cost?: number;
      balance?: number;
    };
    if (!result.conversation_id) {
      toast.error("Contact impossible, réessayez.");
      return;
    }
    if (result.first_contact === false) {
      setScreen({ kind: "already-open", conversationId: result.conversation_id });
      toast.success("Vous avez déjà un contact ouvert avec ce développeur.");
      return;
    }
    toast.success(
      `Contact ouvert pour ${result.cost ?? cost} Token${(result.cost ?? cost) > 1 ? "s" : ""} — discutez en toute sécurité.`
    );
    router.push(`/conversations/${result.conversation_id}`);
  };

  const ctaLabel = label ?? `Contacter — ${contactCost} Token${contactCost > 1 ? "s" : ""}`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button className={cn(className)} aria-label={`Contacter ${developer.full_name ?? "ce développeur"}`}>
            <MessageCircle className="size-4" aria-hidden="true" />
            {ctaLabel}
          </Button>
        }
      />
      <DialogContent className="max-w-md">
        {screen.kind === "gated" && !authed ? (
          <NotAllowed
            icon={<Lock className="size-5" aria-hidden="true" />}
            title="Connexion requise"
            body="Créez un compte client gratuit pour contacter les développeurs de l’annuaire."
            action={
              <Link href="/login">
                <Button className="w-full">Se connecter</Button>
              </Link>
            }
          />
        ) : screen.kind === "gated" && role !== "client" ? (
          <NotAllowed
            icon={<Lock className="size-5" aria-hidden="true" />}
            title="Réservé aux clients"
            body="Le contact direct est proposé aux comptes clients. Les développeurs rejoignent l’annuaire via la messagerie des projets."
            action={
              <Link href="/poster">
                <Button variant="outline" className="w-full">
                  Publier un projet
                </Button>
              </Link>
            }
          />
        ) : screen.kind === "loading" ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Vérification de votre solde…</p>
          </div>
        ) : screen.kind === "insufficient" ? (
          <NotAllowed
            icon={<Coins className="size-5" aria-hidden="true" />}
            title="Solde de Tokens insuffisant"
            body={`Contacter ${developer.full_name ?? "ce développeur"} coûte ${cost} Token${cost > 1 ? "s" : ""} et votre solde est de ${balance ?? 0}. Rechargez votre wallet pour ouvrir le contact.`}
            action={
              <Link href="/wallet#acheter-tokens">
                <Button className="w-full">Obtenir des Tokens</Button>
              </Link>
            }
          />
        ) : screen.kind === "already-open" ? (
          <NotAllowed
            icon={<MessageCircle className="size-5" aria-hidden="true" />}
            title="Conversation déjà ouverte"
            body={`Vous n’êtes pas débité à nouveau : continuez simplement la discussion avec ${developer.full_name ?? "ce développeur"}.`}
            action={
              <Button
                className="w-full"
                onClick={() => router.push(`/conversations/${screen.conversationId}`)}
              >
                Ouvrir la conversation
              </Button>
            }
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Contacter {developer.full_name ?? "ce développeur"}</DialogTitle>
              <p className="text-sm text-muted-foreground">
                {developer.professional_title || developer.main_specialty || "Développeur indépendant"}
                {developer.city ? ` · ${developer.city}` : ""}
              </p>
            </DialogHeader>

            <div className="flex flex-col gap-3">
              <div className="rounded-xl border border-hairline bg-muted p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Coût du contact</span>
                  <span className="font-semibold">
                    {cost} Token{cost > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Votre solde</span>
                  <span className="font-medium">{balance ?? 0} Token{(balance ?? 0) > 1 ? "s" : ""}</span>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-hairline pt-2 text-sm">
                  <span className="text-muted-foreground">Solde après</span>
                  <span className="font-semibold text-primary">
                    {(balance ?? 0) - cost} Token{(balance ?? 0) - cost > 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contact-message">Un mot pour le développeur (optionnel)</Label>
                <Textarea
                  id="contact-message"
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Bonjour, j’aimerais discuter d’un projet…"
                  maxLength={1000}
                  disabled={busy}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                Annuler
              </Button>
              <Button onClick={confirm} disabled={busy}>
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="size-4" aria-hidden="true" />
                )}
                Confirmer — {cost} Token{cost > 1 ? "s" : ""}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NotAllowed({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        {icon}
      </span>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      <div className="mt-2 w-full max-w-[240px]">{action}</div>
    </div>
  );
}