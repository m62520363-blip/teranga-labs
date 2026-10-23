"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { toast } from "sonner";

export function ShareProfileButton({ url, label }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const absoluteUrl = url.startsWith("http")
      ? url
      : `${window.location.origin}${url}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Profil développeur – Devmarket",
          url: absoluteUrl,
        });
        return;
      } catch {
        // L'utilisateur a annulé le partage natif : on retombe sur le presse-papiers.
      }
    }
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      toast.success("Lien du profil copié");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier le lien.");
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-hairline bg-card px-5 text-sm font-medium text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      {copied ? (
        <Check className="size-4 text-success" aria-hidden="true" />
      ) : (
        <Share2 className="size-4 text-primary" aria-hidden="true" />
      )}
      {label ?? "Partager ce profil"}
    </button>
  );
}