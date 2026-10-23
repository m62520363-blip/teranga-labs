"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function initialsOf(name: string, email: string | null): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return (email ?? "?").trim().charAt(0).toUpperCase() || "?";
  }
  const first = parts[0].charAt(0);
  const second = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + second).toUpperCase();
}

export function ProfileForm({
  initialName,
  email,
}: {
  initialName: string | null;
  email: string | null;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(initialName ?? "");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const dirty = name.trim() !== (initialName ?? "");
  const canSave = dirty && name.trim().length > 0 && !saving;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    if (!isSupabaseConfigured()) {
      setError("Configuration Supabase manquante.");
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      data: { full_name: name.trim() },
    });
    setSaving(false);
    if (updateError) {
      setError(updateError.message || "Enregistrement impossible. Réessayez.");
      return;
    }
    toast.success("Nom mis à jour.");
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 sm:flex-row sm:items-start">
      <span
        className="mx-auto grid size-20 shrink-0 place-items-center rounded-full bg-primary text-xl font-bold text-ink sm:mx-0 sm:size-24 sm:text-2xl"
        aria-hidden="true"
      >
        {initialsOf(name || initialName || "", email)}
      </span>
      <div className="min-w-0 flex-1">
        <Label htmlFor="display-name">Nom affiché</Label>
        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <Input
            id="display-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder="Ton nom affiché"
            className="h-10 rounded-xl"
            autoComplete="name"
          />
          <button
            type="submit"
            disabled={!canSave}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground outline-none transition-colors hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-50 sm:self-start"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="size-4" aria-hidden="true" />
            )}
            Enregistrer
          </button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Ton avatar utilise les initiales de ton nom.
        </p>
        {error ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
