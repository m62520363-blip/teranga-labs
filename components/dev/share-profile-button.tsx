"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { toast } from "sonner";

export function ShareProfileButton({ url, label }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Profil développeur · Teranga Labs",
          url,
        });
        return;
      } catch {
        // L'utilisateur a annulé le partage natif : on retombe sur le presse-papiers.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
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
      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#2A2A2A] bg-[#141414] px-5 text-sm font-medium text-[#F2F2F2] transition-colors outline-none hover:bg-[#1E1E1E] focus-visible:ring-2 focus-visible:ring-[#E86A2C]/50"
    >
      {copied ? (
        <Check className="size-4 text-[#4ADE80]" aria-hidden="true" />
      ) : (
        <Share2 className="size-4 text-[#E86A2C]" aria-hidden="true" />
      )}
      {label ?? "Partager ce profil"}
    </button>
  );
}