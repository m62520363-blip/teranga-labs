"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Upload } from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { maskEmail } from "@/components/nav/shell-parts";
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
  userId,
  initialName,
  initialAvatar,
  email,
}: {
  userId?: string;
  initialName: string | null;
  initialAvatar?: string | null;
  email: string | null;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(initialName ?? "");
  const [avatarUrl, setAvatarUrl] = React.useState(initialAvatar ?? "");
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const dirty =
    name.trim() !== (initialName ?? "") ||
    avatarUrl.trim() !== (initialAvatar ?? "");
  const canSave = dirty && name.trim().length > 0 && !saving && !uploading;

  const handlePhotoUpload = async (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Format accepté : JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image trop lourde (2 Mo max).");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: fd,
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        url?: string;
        message?: string;
      };
      if (!res.ok || !json.url) {
        toast.error(
          json.message ?? "Téléversement indisponible — réessayez."
        );
        return;
      }
      setAvatarUrl(json.url);
      toast.success("Photo prête à être enregistrée.");
    } catch {
      toast.error("Téléversement indisponible — réessayez.");
    } finally {
      setUploading(false);
    }
  };

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
      data: {
        full_name: name.trim(),
        avatar_url: avatarUrl.trim() || null,
      },
    });
    setSaving(false);
    if (updateError) {
      setError(updateError.message || "Enregistrement impossible. Réessayez.");
      return;
    }
    toast.success("Profil mis à jour.");
    router.refresh();
  };

  const masked = maskEmail(email);

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-5 sm:flex-row sm:items-start"
    >
      <div className="flex flex-col items-center gap-2">
        {avatarUrl.trim() ? (
          <Image
            src={avatarUrl.trim()}
            alt={name || "Avatar"}
            width={96}
            height={96}
            unoptimized
            className="size-20 shrink-0 rounded-full border border-hairline object-cover sm:size-24"
          />
        ) : (
          <span
            className="grid size-20 shrink-0 place-items-center rounded-full bg-primary text-xl font-bold text-ink sm:size-24 sm:text-2xl"
            aria-hidden="true"
          >
            {initialsOf(name || initialName || "", email)}
          </span>
        )}
        <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-hairline bg-surface px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          {uploading ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Upload className="size-3.5" aria-hidden="true" />
          )}
          Ajouter une photo
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void handlePhotoUpload(file);
            }}
          />
        </label>
      </div>

      <div className="min-w-0 flex-1 space-y-4">
        <div>
          <Label htmlFor="display-name">Nom</Label>
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
        </div>

        {masked ? (
          <div>
            <Label>Email</Label>
            <p className="mt-1 text-sm text-muted-foreground">{masked}</p>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
