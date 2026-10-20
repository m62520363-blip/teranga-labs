"use client";

import * as React from "react";
import { toast } from "sonner";
import { CircleDollarSign, Loader2 } from "lucide-react";
import { formatFCFA } from "@/lib/formatting";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

/**
 * Bouton « Payer » d'une mission (client uniquement, statut
 * awaiting_payment). Ouvre la session Chariow puis redirige vers
 * l'URL de lancement renvoyée par le serveur.
 */
export function MissionPayButton({
  missionId,
  amountFcfa,
  className,
  size = "sm",
}: {
  missionId: string;
  amountFcfa: number;
  className?: string;
  size?: "sm" | "default" | "lg";
}) {
  const [busy, setBusy] = React.useState(false);

  const pay = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/payments/mission-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ missionId }),
      });
      const data = (await res.json().catch(() => null)) as
        | { launchUrl?: string; message?: string }
        | null;
      if (!res.ok || !data?.launchUrl) {
        toast.error(data?.message ?? "Paiement indisponible pour l'instant.");
        return;
      }
      window.location.href = data.launchUrl;
    } catch {
      toast.error("Erreur lors du paiement.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      size={size}
      className={cn("h-8", className)}
      disabled={busy}
      onClick={() => void pay()}
    >
      {busy ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <CircleDollarSign className="size-3.5" aria-hidden="true" />
      )}
      Payer {formatFCFA(amountFcfa)}
    </Button>
  );
}
