"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "cn";

const SIGNED_URL_TTL_SECONDS = 60 * 60;
const signedUrlCache = new Map<string, string>();

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

type Props = {
  messageId: string;
  durationSeconds?: number | null;
  className?: string;
};

export function AudioMessage({ messageId, durationSeconds, className }: Props) {
  const [url, setUrl] = React.useState<string | null>(
    signedUrlCache.get(messageId) ?? null
  );
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    signedUrlCache.has(messageId) ? "ready" : "loading"
  );

  React.useEffect(() => {
    const cached = signedUrlCache.get(messageId);
    if (cached) {
      setUrl(cached);
      setStatus("ready");
      return;
    }

    let active = true;
    const supabase = createClient();

    (async () => {
      const { data, error } = await supabase.rpc("get_message_audio_url", {
        p_message_id: messageId,
      });
      const path =
        !error && data ? (data as { path?: unknown }).path : null;
      if (!active) return;
      if (typeof path !== "string" || path.length === 0) {
        setStatus("error");
        return;
      }
      const { data: signed, error: signError } = await supabase.storage
        .from("message-audio")
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      if (!active) return;
      if (signError || !signed?.signedUrl) {
        setStatus("error");
        return;
      }
      signedUrlCache.set(messageId, signed.signedUrl);
      setUrl(signed.signedUrl);
      setStatus("ready");
    })();

    return () => {
      active = false;
    };
  }, [messageId]);

  if (status === "error") {
    return (
      <p className={cn("text-xs italic opacity-80", className)}>
        Audio indisponible
      </p>
    );
  }

  if (status === "loading" || !url) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-xs opacity-80",
          className
        )}
      >
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        Chargement de l’audio…
      </span>
    );
  }

  return (
    <div className={cn("flex min-w-44 flex-col gap-1.5", className)}>
      <span className="text-[10px] font-medium uppercase tracking-wide opacity-70">
        Message vocal
        {typeof durationSeconds === "number"
          ? ` · ${formatDuration(durationSeconds)}`
          : ""}
      </span>
      <audio controls preload="none" src={url} className="w-52 max-w-full" />
    </div>
  );
}
