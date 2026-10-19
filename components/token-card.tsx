"use client";

import * as React from "react";
import Link from "next/link";
import {
  Coins,
  CreditCard,
  ExternalLink,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import type { TokenPackage } from "@/types/database";
import { formatFCFA } from "@/lib/formatting";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

function useBuyFlow(pkg: TokenPackage) {
  const [step, setStep] = React.useState<
    | "confirm"
    | "login"
    | "placing"
    | "redirecting"
    | "error"
  >("confirm");
  const [errorMessage, setErrorMessage] = React.useState<string>("");

  const resetStep = () => {
    setStep("confirm");
    setErrorMessage("");
  };

  /**
   * Paiement en ligne via /api/payments/checkout.
   *
   * Aucune commande manuelle n'est creee ici : on demande une session de
   * paiement Chariow et on redirige. Le credit se fait a l'arrivee du
   * Pulse signe, apres re-verification serveur de la vente.
   *
   * `window.location.assign` et non un <Link> : l'URL est une page
   * tierce (paiement Chariow) et doit quitter le site, pas etre routee
   * par Next.
   */
  const payOnline = async () => {
    setErrorMessage("");
    setStep("placing");

    try {
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: pkg.id }),
      });
      const payload = (await response.json().catch(() => null)) as {
        launchUrl?: string;
        code?: string;
        message?: string;
      } | null;

      if (response.status === 401) {
        setStep("login");
        return;
      }

      if (!response.ok || !payload?.launchUrl) {
        setErrorMessage(
          payload?.message ??
            "Le paiement en ligne est indisponible pour le moment."
        );
        setStep("error");
        return;
      }

      setStep("redirecting");
      window.location.assign(payload.launchUrl);
    } catch {
      setErrorMessage(
        "Connexion impossible. Verifiez votre reseau puis reessayez."
      );
      setStep("error");
    }
  };

  return { step, errorMessage, payOnline, resetStep };
}

export function TokenCard({ pkg }: { pkg: TokenPackage }) {
  const [open, setOpen] = React.useState(false);
  const { step, errorMessage, payOnline, resetStep } = useBuyFlow(pkg);
  const pricePerToken = pkg.tokens > 0 ? Math.round(pkg.price_fcfa / pkg.tokens) : 0;

  return (
    <div
      className={cn(
        "relative flex h-full flex-col rounded-2xl border bg-card p-6 transition-all duration-300",
        pkg.popular
          ? "border-primary/50 shadow-md"
          : "border-hairline shadow-sm hover:border-primary/30"
      )}
    >
      {pkg.popular && (
        <span className="absolute -top-3 left-6 inline-flex h-6 items-center rounded-full bg-primary px-3 text-[11px] font-semibold uppercase tracking-wide text-ink">
          Populaire
        </span>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold tracking-tight">{pkg.name}</h3>
        <Coins className="size-5 text-primary" aria-hidden="true" />
      </div>

      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-3xl font-semibold tracking-tight">{pkg.tokens}</span>
        <span className="text-muted-foreground">
          token{pkg.tokens > 1 ? "s" : ""}
        </span>
      </div>

      <p className="mt-3 text-lg font-semibold tracking-tight">
        {formatFCFA(pkg.price_fcfa)}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {pricePerToken >= 1 ? `${formatFCFA(pricePerToken)} / token` : "—"}
      </p>

      <div className="mt-auto pt-6">
        <Button
          variant={pkg.popular ? "default" : "outline"}
          className="h-10 w-full"
          onClick={() => {
            resetStep();
            setOpen(true);
          }}
        >
          Acheter
        </Button>
      </div>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            setOpen(false);
            resetStep();
          } else {
            setOpen(true);
          }
        }}
      >
        <DialogContent className="max-w-md">
          {step === "confirm" ? (
            <>
              <DialogHeader>
                <DialogTitle>Commander le pack {pkg.name}</DialogTitle>
                <DialogDescription>
                  {pkg.tokens} token{pkg.tokens > 1 ? "s" : ""} ·{" "}
                  {formatFCFA(pkg.price_fcfa)}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-3 rounded-xl bg-muted p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
                  Paiement sécurisé, Tokens crédités automatiquement
                </div>
                <ol className="list-inside list-decimal space-y-1.5 text-sm leading-relaxed text-muted-foreground">
                  <li>Vous réglez sur la page de paiement sécurisée (carte ou mobile money).</li>
                  <li>Vos Tokens sont crédités dès que le paiement est confirmé.</li>
                </ol>
                <p className="border-t border-hairline pt-3 text-xs leading-relaxed text-muted-foreground">
                  Le règlement est encaissé par Chariow, prestataire de paiement.
                  Vos Tokens sont crédités dès la confirmation du paiement.
                </p>
              </div>

              <DialogFooter className="gap-2">
                <Button className="h-9 w-full" onClick={payOnline}>
                  <CreditCard className="size-4" aria-hidden="true" />
                  Payer maintenant
                </Button>
              </DialogFooter>
            </>
          ) : null}

          {step === "login" ? (
            <>
              <DialogHeader>
                <DialogTitle>Connexion requise</DialogTitle>
                <DialogDescription>
                  Connectez-vous à votre compte pour acheter des Tokens.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <DialogClose
                  render={
                    <Button variant="outline" type="button" className="h-9">
                      Fermer
                    </Button>
                  }
                />
                <Button
                  className="h-9"
                  render={
                    <Link href="/login">
                      <ExternalLink className="size-4" aria-hidden="true" />
                      Se connecter
                    </Link>
                  }
                />
              </DialogFooter>
            </>
          ) : null}

          {step === "placing" || step === "redirecting" ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {step === "redirecting"
                    ? "Redirection vers le paiement…"
                    : "Préparation du paiement…"}
                </DialogTitle>
              </DialogHeader>
              <div className="flex justify-center py-6">
                <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
              </div>
              {step === "redirecting" ? (
                <p className="text-center text-xs leading-relaxed text-muted-foreground">
                  Vous allez quitter TERANGA LABS pour la page de paiement
                  sécurisée. Ne fermez pas cet onglet.
                </p>
              ) : null}
            </>
          ) : null}

          {step === "error" ? (
            <>
              <DialogHeader>
                <DialogTitle>Paiement indisponible</DialogTitle>
                <DialogDescription>{errorMessage}</DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <DialogClose
                  render={
                    <Button variant="outline" type="button" className="h-9">
                      Fermer
                    </Button>
                  }
                />
                <Button variant="outline" className="h-9" onClick={payOnline}>
                  Réessayer
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}