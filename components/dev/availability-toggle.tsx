"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function AvailabilityToggle({
  initialAvailable,
  initialDailyRate,
}: {
  initialAvailable: boolean;
  initialDailyRate: number | null;
}) {
  const [available, setAvailable] = React.useState(initialAvailable);
  const [dailyRate, setDailyRate] = React.useState(
    initialDailyRate ? String(initialDailyRate) : ""
  );
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("update_developer_availability", {
      p_available: available,
      p_daily_rate_fcfa: dailyRate ? parseInt(dailyRate, 10) : null,
    });
    setSaving(false);
    if (error) {
      toast.error("Impossible de mettre à jour la disponibilité.");
      return;
    }
    toast.success("Disponibilité mise à jour.");
  };

  return (
    <div className="rounded-2xl border border-hairline bg-card p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">Disponibilité</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {available
              ? "Vous êtes visible comme disponible pour de nouveaux projets."
              : "Vous n'acceptez pas de nouveaux projets pour le moment."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAvailable(!available)}
          className="shrink-0"
          aria-label={available ? "Désactiver la disponibilité" : "Activer la disponibilité"}
        >
          {available ? (
            <CheckCircle2 className="size-8 text-primary" aria-hidden="true" />
          ) : (
            <Circle className="size-8 text-muted-foreground" aria-hidden="true" />
          )}
        </button>
      </div>

      <div className="mt-4">
        <Label htmlFor="daily-rate" className="text-sm">
          Tarif journalier (FCFA)
        </Label>
        <Input
          id="daily-rate"
          type="number"
          min="0"
          step="1000"
          value={dailyRate}
          onChange={(e) => setDailyRate(e.target.value)}
          placeholder="Ex : 50000"
          className="mt-1.5"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Laissez vide si vous préférez ne pas afficher votre tarif.
        </p>
      </div>

      <Button
        size="sm"
        onClick={() => void save()}
        disabled={saving}
        className="mt-4 gap-2"
      >
        {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {saving ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </div>
  );
}
