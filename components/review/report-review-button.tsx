"use client";

import * as React from "react";
import { Flag, Loader2, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  REVIEW_REPORT_REASONS,
} from "@/lib/reviews-labels";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "cn";

export function ReportReviewButton({
  reviewId,
  reviewAuthor,
  variant,
  onReported,
}: {
  reviewId: string;
  reviewAuthor: string | null;
  variant?: "link" | "button";
  onReported?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [user, setUser] = React.useState<{ id: string } | null | undefined>(undefined);
  const [reason, setReason] = React.useState<string | null>(null);
  const [details, setDetails] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ? { id: data.user.id } : null);
    });
  }, []);

  const submit = async () => {
    if (!reason || submitting) return;
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("submit_review_report", {
      p_review_id: reviewId,
      p_reason: reason,
      p_details: details.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      return;
    }
    setOpen(false);
    setReason(null);
    setDetails("");
    onReported?.();
  };

  const trigger = (
    <span
      role="button"
      tabIndex={0}
      onClick={() => setOpen(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen(true);
        }
      }}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        variant === "button"
          ? "rounded-lg border border-hairline bg-[#141414] px-3 py-1.5 text-muted-foreground transition-colors hover:border-[#F87171]/40 hover:text-[#F87171]"
          : "text-muted-foreground transition-colors hover:text-[#F87171]"
      )}
    >
      <Flag className="size-3.5" aria-hidden="true" />
      Signaler
    </span>
  );

  if (user === undefined) {
    return <span aria-hidden="true" className="invisible" />;
  }

  if (user === null) {
    return (
      <>
        {trigger}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connectez-vous pour signaler</DialogTitle>
              <DialogDescription>
                Seuls les utilisateurs connectés peuvent signaler un avis.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2">
              <Link href="/auth" className={buttonVariants({ className: "w-full" })}>
                Se connecter
              </Link>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      {trigger}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
        <DialogHeader>
          <DialogTitle>Signaler cet avis</DialogTitle>
          <DialogDescription>
            {reviewAuthor
              ? `Avis déposé par ${reviewAuthor}.`
              : "Avis déposé sur une fiche développeur."}{" "}
            Un avis signalé est examiné par notre équipe de modération. Notez
            qu’un avis vérifié est lié à une mission réellement livrée.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 flex flex-col gap-4">
          <div className="flex flex-col gap-2.5">
            <Label>Motif du signalement</Label>
            <div className="grid gap-2">
              {REVIEW_REPORT_REASONS.map((r) => (
                <label
                  key={r.value}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-colors",
                    reason === r.value
                      ? "border-primary/60 bg-[#2A1A10] text-foreground"
                      : "border-hairline bg-surface text-muted-foreground hover:border-[#3A3A3A]"
                  )}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    className="size-4 accent-primary"
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="report-details">Précisions (facultatif)</Label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={2000}
              rows={3}
              className="min-h-20 rounded-xl"
              placeholder="Donnez des précisions à notre équipe sans attaques personnelles."
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!reason || submitting}
            onClick={submit}
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ShieldAlert className="size-4" aria-hidden="true" />
            )}
            Envoyer le signalement
          </Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>
    </>
  );
}