"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Crown,
  Gift,
  Loader2,
  Lock,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { decodeUnlockError } from "@/lib/tokens";
import { formatFCFA } from "@/lib/formatting";
import { useBalance } from "@/components/balance-provider";

export type BriefPayload = {
  id: string;
  client_name: string;
  project_type: string;
  client_city?: string;
  budget: number;
  description: string;
  demo?: boolean;
  created_at: string;
};

type Phase =
  | { kind: "closed" }
  | { kind: "confirm" }
  | { kind: "submitting" }
  | { kind: "quota-reached" }
  | { kind: "error"; message: string; code?: string };

export function UnlockDialog({
  brief,
  user,
  balance,
  conversationId,
  welcomeFree = false,
}: {
  brief: BriefPayload;
  user: { id: string } | null;
  balance: number | null;
  conversationId: string | null;
  welcomeFree?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>({ kind: "closed" });
  const [message, setMessage] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [days, setDays] = React.useState("");
  const { balance: ctxQuota, quotaLimit, planName, setBalance, refresh } = useBalance();
  const router = useRouter();

  const quotaRemaining = ctxQuota ?? balance;
  const isFree = brief.demo === true || (welcomeFree && !brief.demo);

  const start = () => {
    setOpen(true);
    if (!isFree && quotaRemaining !== null && quotaRemaining <= 0) {
      setPhase({ kind: "quota-reached" });
    } else {
      setPhase({ kind: "confirm" });
    }
  };

  const submit = async () => {
    const content = message.trim();
    if (!content) return;

    setPhase({ kind: "submitting" });
    const supabase = createClient();
    const { data, error } = await supabase.rpc("unlock_and_start_chat", {
      p_request_id: brief.id,
      p_initial_message: content,
      p_estimated_price: price ? Number.parseInt(price, 10) || 0 : 0,
      p_estimated_days: days ? Number.parseInt(days, 10) || 0 : 0,
    });

    if (error) {
      const messageErr = decodeUnlockError(
        error.code,
        error.message || "Une erreur est survenue. Réessayez."
      );
      if (error.code === "TLQUO" || error.code === "TLLOW") {
        setPhase({ kind: "quota-reached" });
      } else {
        setPhase({ kind: "error", message: messageErr, code: error.code ?? undefined });
      }
      return;
    }

    const result = data as {
      conversation_id?: string;
      quota_remaining?: number;
      balance?: number;
    } | null;

    if (typeof result?.quota_remaining === "number") {
      setBalance(result.quota_remaining);
    } else if (typeof result?.balance === "number") {
      setBalance(result.balance);
    }
    void refresh();

    void fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "contact_unlocked", request_id: brief.id }),
    }).catch(() => undefined);

    if (result?.conversation_id) {
      router.push(`/conversations/${result.conversation_id}`);
      return;
    }
    setPhase({ kind: "closed" });
  };

  if (!user) {
    return (
      <Button
        variant="default"
        size="sm"
        className="h-8"
        render={
          <Link href="/login">
            Envoyer une proposition
          </Link>
        }
      />
    );
  }

  if (conversationId) {
    return (
      <Button
        variant="secondary"
        size="sm"
        className="h-8 border-success/30 bg-success-soft text-success hover:bg-success/20"
        render={
          <Link href={`/conversations/${conversationId}`}>
            <MessageCircle className="size-3.5" aria-hidden="true" />
            Ouvrir la discussion
          </Link>
        }
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => setOpen(o)}>
      <Button variant="default" size="sm" className="h-8" onClick={start}>
        <MessageCircle className="size-3.5" aria-hidden="true" />
        Envoyer une proposition
      </Button>
      <DialogContent className="max-w-sm">
        {phase.kind === "confirm" || phase.kind === "submitting" ? (
          <React.Fragment>
            <DialogHeader>
              <DialogTitle>Votre proposition à {brief.client_name}</DialogTitle>
              <DialogDescription className="sr-only">
                Première prise de contact avec le client du projet {brief.client_name}.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-xl border border-hairline bg-muted p-4">
              <p className="text-sm font-medium">{brief.client_name}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {formatFCFA(brief.budget)} ·{" "}
                {brief.project_type}
              </p>
              {welcomeFree ? (
                <p className="mt-2 inline-flex items-center gap-1 rounded-full border border-success/30 bg-success-soft px-2.5 py-0.5 text-[11px] font-semibold text-success">
                  <Gift className="size-3" aria-hidden="true" />
                  1er contact d’essai inclus
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="unlock-message">
                  Votre message <span className="text-primary">*</span>
                </Label>
                <Textarea
                  id="unlock-message"
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Bonjour, je suis développeur basé à… Décrivez en 2-3 lignes votre approche et vos références pertinentes."
                  disabled={phase.kind === "submitting"}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="unlock-price">Devis estimé (FCFA)</Label>
                  <Input
                    id="unlock-price"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Ex. 150000"
                    disabled={phase.kind === "submitting"}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="unlock-days">Délai (jours)</Label>
                  <Input
                    id="unlock-days"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    placeholder="Ex. 21"
                    disabled={phase.kind === "submitting"}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-hairline px-4 py-2.5 text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Crown className="size-4 text-primary" aria-hidden="true" />
                  {planName ? `Formule ${planName}` : "Quota mensuel"}
                </span>
                {quotaRemaining !== null ? (
                  <span className="font-medium text-muted-foreground">
                    {quotaRemaining}
                    {quotaLimit !== null ? ` / ${quotaLimit}` : ""} contact
                    {quotaRemaining > 1 ? "s" : ""} restant{quotaRemaining > 1 ? "s" : ""}
                  </span>
                ) : null}
              </div>

              <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span>
                  1 contact de projet sera décompté de votre quota mensuel (un
                  même projet n’est jamais comptabilisé deux fois).
                </span>
              </p>
            </div>

            <DialogFooter className="gap-2">
              <DialogCloseButton disabled={phase.kind === "submitting"} />
              <Button
                onClick={submit}
                disabled={phase.kind === "submitting" || !message.trim()}
                className="h-9"
              >
                {phase.kind === "submitting" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="size-4" aria-hidden="true" />
                )}
                {phase.kind === "submitting"
                  ? "Envoi en cours…"
                  : "Envoyer ma proposition"}
              </Button>
            </DialogFooter>
          </React.Fragment>
        ) : null}

        {phase.kind === "quota-reached" ? (
          <React.Fragment>
            <DialogHeader>
              <DialogTitle>Limite mensuelle atteinte</DialogTitle>
              <DialogDescription className="sr-only">
                Passez à une formule supérieure pour envoyer davantage de propositions ce mois-ci.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary-soft p-3.5">
                <Crown className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <div className="text-sm text-foreground">
                  <p className="font-semibold">
                    Votre quota mensuel de propositions est atteint.
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Passez à une formule supérieure pour contacter jusqu’à 80
                    projets/mois (Pro), 200 projets/mois (Pro Max) ou 400
                    projets/mois (Agence). Aucun supplément n’est facturé sans
                    votre accord.
                  </p>
                </div>
              </div>

              <Button
                className="h-10 bg-primary text-ink hover:bg-primary-hover"
                render={
                  <Link href="/abonnement">
                    <Crown className="size-4" aria-hidden="true" />
                    Voir les formules d’abonnement
                  </Link>
                }
              />
              <DialogFooter className="gap-2">
                <DialogCloseButton />
              </DialogFooter>
            </div>
          </React.Fragment>
        ) : null}

        {phase.kind === "error" ? (
          <React.Fragment>
            <DialogHeader>
              <DialogTitle>Impossible d’envoyer</DialogTitle>
              <DialogDescription className="sr-only">
                Une erreur est survenue lors de l’envoi de votre proposition.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex items-center gap-2 text-sm text-destructive">
                <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
                {phase.message}
              </div>
              <DialogFooter className="gap-2">
                <DialogCloseButton />
                {phase.code === "TLPEN" || phase.code === "TLRJC" ? (
                  <Button
                    className="h-9"
                    render={<Link href="/dashboard">Mon compte</Link>}
                  />
                ) : (
                  <Button onClick={submit} className="h-9">
                    Réessayer
                  </Button>
                )}
              </DialogFooter>
            </div>
          </React.Fragment>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DialogCloseButton({ disabled = false }: { disabled?: boolean }) {
  return (
    <DialogClose
      disabled={disabled}
      render={
        <Button variant="outline" type="button">
          {disabled ? (
            <Check className="size-4" aria-hidden="true" />
          ) : (
            "Fermer"
          )}
        </Button>
      }
    />
  );
}
