"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Lock, MessageCircle, Send } from "lucide-react";
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
  role: string | null;
  authed: boolean;
  label?: string;
  className?: string;
};

type Screen =
  | { kind: "gated" }
  | { kind: "ready" }
  | { kind: "already-open"; conversationId: string };

/**
 * Bouton et modale de prise de contact directe d'un client vers un développeur.
 * Conformément à la Section D, l'échange avec les développeurs est 100 % gratuit
 * pour les clients (aucun abonnement ni monnaie virtuelle requis).
 */
export function ContactButton({
  developer,
  role,
  authed,
  label,
  className,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [screen, setScreen] = React.useState<Screen>({ kind: "gated" });
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const trackedClick = React.useRef(false);

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
        }).catch(() => undefined);
      }
      setMessage("");
      setBusy(false);
      if (!authed || role !== "client") {
        setScreen({ kind: "gated" });
        return;
      }
      setScreen({ kind: "ready" });
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
      if (code === "TLRJC" || code === "TLNAU") {
        setScreen({ kind: "gated" });
      }
      toast.error(error.message || "Contact impossible, réessayez.");
      return;
    }
    const result = (data ?? {}) as {
      conversation_id?: string;
      first_contact?: boolean;
    };
    if (!result.conversation_id) {
      toast.error("Contact impossible, réessayez.");
      return;
    }
    if (result.first_contact === false) {
      setScreen({ kind: "already-open", conversationId: result.conversation_id });
      toast.success("Vous avez déjà une discussion ouverte avec ce développeur.");
      return;
    }
    toast.success("Discussion ouverte gratuitement — échangez en direct.");
    router.push(`/conversations/${result.conversation_id}`);
  };

  const ctaLabel = label ?? "Contacter gratuitement";
  const name = developer.full_name ?? developer.username ?? "ce développeur";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="default"
            size="sm"
            className={cn("h-10 gap-2 rounded-xl", className)}
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            {ctaLabel}
          </Button>
        }
      />

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Contacter {name}</DialogTitle>
        </DialogHeader>

        {screen.kind === "gated" ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-hairline bg-muted p-4">
              <Lock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <div className="text-sm leading-relaxed text-muted-foreground">
                {!authed ? (
                  <>
                    Connectez-vous à votre compte client (gratuit et sans
                    engagement) pour échanger directement avec {name}.
                  </>
                ) : (
                  <>
                    Le contact direct depuis l’annuaire est réservé aux comptes
                    clients.
                  </>
                )}
              </div>
            </div>
            <DialogFooter>
              {!authed ? (
                <div className="flex w-full flex-wrap justify-end gap-2">
                  <Button
                    variant="outline"
                    render={<Link href="/signup">Créer un compte client gratuit</Link>}
                  />
                  <Button render={<Link href="/login">Se connecter</Link>} />
                </div>
              ) : (
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Fermer
                </Button>
              )}
            </DialogFooter>
          </div>
        ) : null}

        {screen.kind === "ready" ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-primary/25 bg-primary-soft p-3.5 text-xs text-foreground">
              Contact direct <strong>100 % gratuit</strong> et sans commission.
              Décrivez votre besoin pour démarrer la discussion privée avec {name}.
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="direct-contact-message">
                Premier message (optionnel mais recommandé)
              </Label>
              <Textarea
                id="direct-contact-message"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Bonjour, je souhaite créer un site / une application pour… Voici mon besoin et mon délai souhaité."
                disabled={busy}
              />
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                Annuler
              </Button>
              <Button type="button" onClick={confirm} disabled={busy}>
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="size-4" aria-hidden="true" />
                )}
                Démarrer la discussion
              </Button>
            </DialogFooter>
          </div>
        ) : null}

        {screen.kind === "already-open" ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Une conversation est déjà ouverte avec {name}.
            </p>
            <DialogFooter>
              <Button
                render={
                  <Link href={`/conversations/${screen.conversationId}`}>
                    Ouvrir la conversation
                  </Link>
                }
              />
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
