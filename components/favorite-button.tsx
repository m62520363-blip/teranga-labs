"use client";

import { useCallback, useEffect, useState } from "react";
import { Heart, Loader2 } from "lucide-react";
import { cn } from "cn";

/**
 * Bascule de favori d'un brief (§25). Optimiste : le cœur passe à
 * l'état ciblé immédiatement, annulé si le serveur refuse.
 * Sans session, le champ mène vers la connexion.
 */
export function FavoriteButton({
  briefId,
  initialFavorite = false,
  showLabel = false,
}: {
  briefId: string;
  initialFavorite?: boolean;
  showLabel?: boolean;
}) {
  const [favorited, setFavorited] = useState(initialFavorite);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Un changement de page réinitialise le cœur depuis le serveur.
    setFavorited(initialFavorite);
  }, [initialFavorite]);

  const toggle = useCallback(async () => {
    const next = !favorited;
    setFavorited(next); // optimiste
    setBusy(true);
    try {
      const res = await fetch("/api/favorites/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: briefId }),
      });
      if (res.status === 401 || res.status === 403) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        setFavorited(!next); // retour arrière
        return;
      }
      const data = (await res.json()) as { favorited?: boolean };
      setFavorited(data.favorited ?? next);
    } catch {
      setFavorited(!next);
    } finally {
      setBusy(false);
    }
  }, [briefId, favorited]);

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={favorited}
      aria-label={favorited ? "Retirer des favoris" : "Ajouter aux favoris"}
      title={favorited ? "Retirer des favoris" : "Ajouter aux favoris"}
      className={cn(
        "inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-hairline bg-card px-2.5 text-sm transition-colors",
        "outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        favorited
          ? "border-primary/40 text-error"
          : "text-muted-foreground hover:border-border-strong hover:text-foreground",
        busy && "cursor-wait opacity-60"
      )}
    >
      {busy ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Heart
          className={cn("size-3.5", favorited && "fill-current")}
          aria-hidden="true"
        />
      )}
      {showLabel ? (favorited ? "Favori" : "Favori") : null}
    </button>
  );
}