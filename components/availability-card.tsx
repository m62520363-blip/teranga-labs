"use client";

import React from "react";
import { CalendarCheck, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "cn";

// Numérotation des jours conforme à la table developer_availability
// (migration 0049 : « lundi 0 … dimanche 6 »).
const WEEKDAYS = [
  { day: 0, short: "L", label: "Lundi" },
  { day: 1, short: "M", label: "Mardi" },
  { day: 2, short: "M", label: "Mercredi" },
  { day: 3, short: "J", label: "Jeudi" },
  { day: 4, short: "V", label: "Vendredi" },
  { day: 5, short: "S", label: "Samedi" },
  { day: 6, short: "D", label: "Dimanche" },
];

const ALL_DAYS = WEEKDAYS.map((w) => w.day);

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

export default function AvailabilityCard({ userId }: { userId: string }) {
  const [loading, setLoading] = React.useState(true);
  const [available, setAvailable] = React.useState(false);
  const [days, setDays] = React.useState<number[]>(ALL_DAYS);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const { data, error: err } = await supabase
        .from("developer_availability")
        .select("weekday")
        .eq("developer_id", userId);
      if (cancelled) return;
      if (!err && Array.isArray(data) && data.length > 0) {
        setAvailable(true);
        setDays(
          data
            .map((r) => Number(r.weekday))
            .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
            .sort((a, b) => a - b),
        );
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  function toggleDay(day: number) {
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    );
  }

  async function save() {
    setSaving(true);
    setError("");
    setNotice("");
    const supabase = createClient();
    const { error: err } = await supabase.rpc("set_my_availability", {
      p_available: available,
      p_weekdays: available && days.length > 0 ? days : ALL_DAYS,
    });
    setSaving(false);
    if (err) {
      setError(friendlyRpcError(err));
      return;
    }
    setNotice(available ? "Disponibilité enregistrée." : "Vous êtes marqué indisponible.");
  }

  return (
    <div className="rounded-2xl border border-hairline bg-card p-6 sm:p-8">
      <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
        <CalendarCheck className="size-4 text-primary" aria-hidden="true" />
        Disponibilité
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Indiquez si vous acceptez de nouvelles missions, et quels jours vous êtes
        joignable. Votre statut est visible dans l&apos;annuaire.
      </p>

      <div className="mt-5 flex items-center justify-between gap-4">
        <Label htmlFor="availability-switch" className="text-sm font-medium">
          {available ? "Disponible" : "Indisponible"}
        </Label>
        <button
          id="availability-switch"
          type="button"
          role="switch"
          aria-checked={available}
          disabled={loading || saving}
          onClick={() => {
            setAvailable((v) => !v);
            setNotice("");
            setError("");
          }}
          className={cn(
            "relative h-7 w-12 shrink-0 rounded-full border transition-colors outline-none",
            "focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-60",
            available ? "border-primary bg-primary" : "border-hairline bg-muted",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-5 rounded-full bg-card shadow transition-all",
              available ? "left-6" : "left-0.5",
            )}
            aria-hidden="true"
          />
        </button>
      </div>

      <div className="mt-5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Jours où vous êtes joignable
        </span>
        <div className="mt-2 flex flex-wrap gap-2">
          {WEEKDAYS.map((w) => {
            const active = available && days.includes(w.day);
            return (
              <button
                key={w.day}
                type="button"
                aria-pressed={active}
                aria-label={w.label}
                disabled={loading || saving || !available}
                onClick={() => toggleDay(w.day)}
                className={cn(
                  "inline-flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-medium transition-colors outline-none",
                  "focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50",
                  active
                    ? "border-primary bg-primary text-ink"
                    : "border-hairline bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {w.short}
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-4 text-sm text-success" role="status">
          {notice}
        </p>
      ) : null}

      <div className="mt-5">
        <Button
          type="button"
          onClick={save}
          disabled={loading || saving}
          className="h-10 rounded-xl"
        >
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
