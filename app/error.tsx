"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[erreur serveur]", error);
  }, [error]);

  const digest = error.digest;

  return (
    <div className="py-24">
      <div className="container-tl mx-auto max-w-md text-center">
        <p className="font-display text-6xl font-bold text-primary">Erreur</p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          Quelque chose s’est mal passé
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          La page n’a pas pu être chargée. C’est souvent temporaire : la
          connexion est peut-être instable, ou le service est en cours de
          redémarrage. Vos données ne sont pas perdues.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={reset} size="lg" className="h-10 rounded-xl px-5">
            Réessayer
          </Button>
          <Link href="/">
            <Button variant="outline" size="lg" className="h-10 rounded-xl px-5">
              Retour à l’accueil
            </Button>
          </Link>
        </div>

        {digest ? (
          <p className="mt-8 text-[11px] leading-relaxed text-muted-foreground/60">
            Si le problème persiste, signalez-le en indiquant cette référence :{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground">
              {digest}
            </code>
          </p>
        ) : null}
      </div>
    </div>
  );
}
