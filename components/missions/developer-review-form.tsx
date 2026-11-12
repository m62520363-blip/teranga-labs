"use client";

import * as React from "react";
import { Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export function DeveloperReviewForm({ requestId }: { requestId: string }) {
  const [rating, setRating] = React.useState(0);
  const [hover, setHover] = React.useState(0);
  const [comment, setComment] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  const submit = async () => {
    if (rating < 1) {
      toast.error("Choisissez une note.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("submit_developer_review", {
      p_request_id: requestId,
      p_rating: rating,
      p_comment: comment.trim() || null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message || "Impossible d'envoyer l'avis.");
      return;
    }
    setSubmitted(true);
    toast.success("Avis envoyé. Merci !");
  };

  if (submitted) {
    return (
      <div className="rounded-2xl border border-success/30 bg-success-soft p-5 text-center">
        <p className="text-sm font-semibold text-success">Avis envoyé</p>
        <p className="mt-1 text-xs text-muted-foreground">Merci pour votre retour.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-hairline bg-card p-5">
      <h3 className="text-sm font-semibold">Noter le client</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Évaluez votre expérience avec ce client.
      </p>
      <div className="mt-3 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            className="p-1"
            aria-label={`Note ${n} sur 5`}
          >
            <Star
              className={`size-6 transition-colors ${n <= (hover || rating) ? "fill-warning text-warning" : "text-muted-foreground"}`}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
      <Textarea
        className="mt-3"
        placeholder="Commentaire (optionnel)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
      />
      <Button className="mt-3 gap-2" onClick={() => void submit()} disabled={busy || rating < 1}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {busy ? "Envoi..." : "Envoyer l'avis"}
      </Button>
    </div>
  );
}
