"use client";

import * as React from "react";
import { Share2, Copy, Check, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

type ShareButtonProps = {
  url: string;
  title: string;
  text?: string;
  className?: string;
};

export function ShareButton({ url, title, text, className }: ShareButtonProps) {
  const [copied, setCopied] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const fullUrl = typeof window !== "undefined" ? `${window.location.origin}${url}` : url;
  const shareText = text || title;

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${fullUrl}`)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(fullUrl)}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: shareText, url: fullUrl });
      } catch {
        // user cancelled
      }
    } else {
      setOpen(!open);
    }
  };

  return (
    <div className={cn("relative inline-flex", className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={nativeShare}
        className="gap-2"
      >
        <Share2 className="size-4" aria-hidden="true" />
        Partager
      </Button>

      {open && !navigator.share ? (
        <div className="absolute left-0 top-full z-50 mt-2 w-48 rounded-xl border border-hairline bg-card p-2 shadow-lg">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
          >
            <MessageCircle className="size-4 text-green-500" aria-hidden="true" />
            WhatsApp
          </a>
          <a
            href={twitterUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
          >
            <span className="size-4 text-sky-500" aria-hidden="true">𝕏</span>
            Twitter / X
          </a>
          <button
            type="button"
            onClick={copyLink}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
          >
            {copied ? (
              <Check className="size-4 text-primary" aria-hidden="true" />
            ) : (
              <Copy className="size-4" aria-hidden="true" />
            )}
            {copied ? "Copié !" : "Copier le lien"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
