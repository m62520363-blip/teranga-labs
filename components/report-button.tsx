"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Flag, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { decodeUnlockError, REPORT_REASONS } from "@/lib/tokens";

export function ReportButton({
  targetType,
  targetId,
}: {
  targetType: "brief" | "developer";
  targetId: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = React.useState(false);

  const reset = () => {
    setReason("");
    setDescription("");
    setError(null);
    setNeedsLogin(false);
  };

  const submit = async () => {
    if (!reason) {
      setError("Choisissez un motif.");
      return;
    }
    setSubmitting(true);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("submit_report", {
      p_target_type: targetType,
      p_target_id: targetId,
      p_reason: reason,
      p_description: description.trim(),
    });
    setSubmitting(false);
    if (rpcError) {
      if (rpcError.code === "TLNAU") {
        setNeedsLogin(true);
        return;
      }
      setError(
        decodeUnlockError(rpcError.code, rpcError.message || "Signalement impossible.")
      );
      return;
    }
    if (data) {
      toast.success("Signalement envoyé. Merci, notre équipe va étudier ce cas.");
      setOpen(false);
      reset();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setOpen(true)}
            aria-label="Signaler ce brief"
          >
            <Flag className="size-3.5" aria-hidden="true" />
            Signaler
          </Button>
        }
      />
      <DialogContent className="max-w-md">
        {needsLogin ? (
          <>
            <DialogHeader>
              <DialogTitle>Connexion requise</DialogTitle>
              <DialogDescription>
                Connectez-vous pour signaler un contenu à notre équipe.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <DialogClose
                render={
                  <Button variant="outline" type="button">
                    Fermer
                  </Button>
                }
              />
              <Button render={<Link href="/login">Se connecter</Link>} />
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Signaler</DialogTitle>
              <DialogDescription>
                Expliquez à notre équipe pourquoi ce contenu pose problème.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="report-reason" className="text-sm font-medium">
                  Motif
                </Label>
                <Select value={reason} onValueChange={(v) => setReason(v ?? "")}>
                  <SelectTrigger id="report-reason" className="rounded-xl">
                    <SelectValue placeholder="Choisissez un motif" />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="report-description" className="text-sm font-medium">
                  Détails (facultatif)
                </Label>
                <Textarea
                  id="report-description"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="rounded-xl"
                  placeholder="Précisez le contexte…"
                />
              </div>

              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}

              <DialogFooter className="gap-2">
                <DialogClose
                  render={
                    <Button variant="outline" type="button">
                      Annuler
                    </Button>
                  }
                />
                <Button onClick={submit} disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Flag className="size-4" aria-hidden="true" />
                  )}
                  Envoyer le signalement
                </Button>
              </DialogFooter>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}