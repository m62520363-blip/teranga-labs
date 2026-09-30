"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Coins,
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
import { cn } from "cn";

export type BriefPayload = {
  id: string;
  client_name: string;
  project_type: string;
  client_city: string;
  budget: number;
  description: string;
  demo?: boolean;
  created_at: string;
};

type Phase =
  | { kind: "closed" }
  | { kind: "confirm" }
  | { kind: "submitting" }
  | { kind: "no-tokens" }
  | { kind: "error"; message: string; code?: string };

export function UnlockDialog({
  brief,
  user,
  balance,
  conversationId,
}: {
  brief: BriefPayload;
  user: { id: string } | null;
  balance: number | null;
  conversationId: string | null;
}) {
  const [open, setOpen] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>({ kind: "closed" });
  const [message, setMessage] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [days, setDays] = React.useState("");
  const { setBalance } = useBalance();
  const router = useRouter();

  const start = () => {
    setOpen(true);
    if (!brief.demo && (balance ?? 0) < 1) setPhase({ kind: "no-tokens" });
    else setPhase({ kind: "confirm" });
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
      if (error.code === "TLLOW") setPhase({ kind: "no-tokens" });
      else setPhase({ kind: "error", message: messageErr, code: error.code ?? undefined });
      return;
    }

    const result = data as {
      conversation_id?: string;
      balance?: number;
    } | null;

    if (typeof result?.balance === "number") setBalance(result.balance);

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
            Démarrer la discussion ·{" "}
            {brief.demo ? "Gratuit" : "1 Token"}
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
      <UnlockTriggerButton onClick={start} balance={balance} demo={brief.demo} />
      <DialogContent className="max-w-sm">
        {phase.kind === "confirm" || phase.kind === "submitting" ? (
          <React.Fragment>
            <DialogHeader>
              <DialogTitle>Votre proposition à {brief.client_name}</DialogTitle>
              <DialogDescription className="sr-only">
                Première prise de contact avec le client du brief {brief.client_name}.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-xl border border-hairline bg-muted p-4">
              <p className="text-sm font-medium">{brief.client_name}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {brief.client_city} · {formatFCFA(brief.budget)} ·{" "}
                {brief.project_type}
              </p>
              {brief.demo ? (
                <p className="mt-2 inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary-soft px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                  <Sparkles className="size-3" aria-hidden="true" />
                  Brief d’exemple · déblocage gratuit
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
                  placeholder="Bonjour, je suis développeur basé à… Décrivez en 2-3 lignes pourquoi vous êtes le bon profil."
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

              <div className="flex items-center justify-between rounded-xl border border-hairline px-4 py-2.5">
                {brief.demo ? (
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    <Sparkles className="size-4 text-primary" aria-hidden="true" />
                    Déblocage gratuit
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    <Coins className="size-4 text-primary" aria-hidden="true" />
                    {balance ?? 0} token{(balance ?? 0) > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                {brief.demo ? (
                  <>
                    C’est un exemple de démonstration : aucun Token ne sera
                    débité. Le client reçoit votre message dans sa messagerie
                    interne, leur WhatsApp reste privé.
                  </>
                ) : (
                  <>
                    1 Token sera débité : le client reçoit votre message dans sa
                    messagerie interne. Leur WhatsApp reste privé.
                  </>
                )}
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
                  : brief.demo
                    ? "Envoyer gratuitement"
                    : "Envoyer · 1 Token"}
              </Button>
            </DialogFooter>
          </React.Fragment>
        ) : null}

        {phase.kind === "no-tokens" ? (
          <React.Fragment>
            <DialogHeader>
              <DialogTitle>Plus de Tokens</DialogTitle>
              <DialogDescription className="sr-only">
                Rechargez vos Tokens pour démarrer une discussion.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex items-center gap-3 rounded-xl bg-primary-soft p-3.5">
                <Coins className="size-5 shrink-0 text-primary" aria-hidden="true" />
                <p className="text-sm text-foreground">
                  <span className="font-medium">Vous n’avez plus de Tokens.</span>{" "}
                  Démarrer une discussion coûte 1 Token.
                </p>
              </div>
              <Button
                className="h-10 bg-primary hover:bg-primary-hover"
                render={
                  <Link href="/tokens">
                    <Coins className="size-4" aria-hidden="true" />
                    Recharger mes Tokens
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

function UnlockTriggerButton({
  onClick,
  balance,
  demo = false,
}: {
  onClick: () => void;
  balance: number | null;
  demo?: boolean;
}) {
  const insufficient = !demo && (balance ?? 0) < 1;
  return (
    <Button
      variant="default"
      size="sm"
      className={cn("h-8", insufficient && "opacity-70")}
      onClick={onClick}
    >
      <MessageCircle
        className={cn("size-3.5", insufficient && "opacity-70")}
        aria-hidden="true"
      />
      Démarrer la discussion · {demo ? "Gratuit" : "1 Token"}
    </Button>
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