"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Coins,
  CreditCard,
  ExternalLink,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import type { TokenPackage } from "@/types/database";
import { formatFCFA } from "@/lib/formatting";
import { createClient } from "@/lib/supabase/client";
import { decodeUnlockError } from "@/lib/tokens";
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

type OrderResult = {
  id: string;
  package_name: string;
  tokens: number;
  price_fcfa: number;
};

function useBuyFlow(pkg: TokenPackage) {
  const [step, setStep] = React.useState<
    "confirm" | "login" | "placing" | "placed" | "error"
  >("confirm");
  const [order, setOrder] = React.useState<OrderResult | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string>("");

  const resetStep = () => {
    setStep("confirm");
    setOrder(null);
    setErrorMessage("");
  };

  const createOrder = async () => {
    setErrorMessage("");
    setStep("placing");
    const supabase = createClient();
    const { data, error } = await supabase.rpc("create_token_order", {
      p_package_id: pkg.id,
    });
    if (error) {
      if (error.code === "TLNAU") {
        setStep("login");
        return;
      }
      setErrorMessage(decodeUnlockError(error.code, error.message));
      setStep("error");
      return;
    }
    const result = data as {
      order_id?: string;
      package_name?: string;
      tokens?: number;
      price_fcfa?: number;
    } | null;
    if (result?.order_id) {
      setOrder({
        id: result.order_id,
        package_name: result.package_name ?? pkg.name,
        tokens: result.tokens ?? pkg.tokens,
        price_fcfa: result.price_fcfa ?? pkg.price_fcfa,
      });
      setStep("placed");
    } else {
      setErrorMessage("La commande n’a pas pu être créée.");
      setStep("error");
    }
  };

  return { step, order, errorMessage, createOrder, resetStep };
}

export function TokenCard({ pkg }: { pkg: TokenPackage }) {
  const [open, setOpen] = React.useState(false);
  const { step, order, errorMessage, createOrder, resetStep } = useBuyFlow(pkg);
  const pricePerToken = pkg.tokens > 0 ? Math.round(pkg.price_fcfa / pkg.tokens) : 0;

  return (
    <div
      className={cn(
        "relative flex h-full flex-col rounded-2xl border bg-[#141414] p-6 transition-all duration-300",
        pkg.popular
          ? "border-[#E86A2C]/50 shadow-md"
          : "border-[#2A2A2A] shadow-sm hover:border-[#E86A2C]/30"
      )}
    >
      {pkg.popular && (
        <span className="absolute -top-3 left-6 inline-flex h-6 items-center rounded-full bg-[#E86A2C] px-3 text-[11px] font-semibold uppercase tracking-wide text-white">
          Populaire
        </span>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold tracking-tight">{pkg.name}</h3>
        <Coins className="size-5 text-[#E86A2C]" aria-hidden="true" />
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

              <div className="flex flex-col gap-3 rounded-xl bg-[#1E1E1E] p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ShieldCheck className="size-4 text-[#E86A2C]" aria-hidden="true" />
                  Commande validée par notre équipe
                </div>
                <ol className="list-inside list-decimal space-y-1.5 text-sm leading-relaxed text-muted-foreground">
                  <li>Vous créez une commande (numéro de suivi).</li>
                  <li>Vous payez sur votre mobile money habituel (Wave, Orange Money, Max It).</li>
                  <li>Notre équipe vérifie le paiement et crédite vos Tokens.</li>
                </ol>
                <p className="border-t border-[#2A2A2A] pt-3 text-xs leading-relaxed text-muted-foreground">
                  Le paiement en ligne automatique (Wave, Orange Money, Max It)
                  arrive bientôt. En attendant, l’achat se fait à la commande,
                  confirmée une fois l’encaissement vérifié.
                </p>
              </div>

              <DialogFooter className="gap-2">
                <Button className="h-9 w-full" onClick={createOrder}>
                  <CreditCard className="size-4" aria-hidden="true" />
                  Créer la commande
                </Button>
              </DialogFooter>
            </>
          ) : null}

          {step === "login" ? (
            <>
              <DialogHeader>
                <DialogTitle>Connexion requise</DialogTitle>
                <DialogDescription>
                  Connectez-vous à votre compte développeur pour commander des
                  Tokens.
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

          {step === "placing" ? (
            <>
              <DialogHeader>
                <DialogTitle>Création de la commande…</DialogTitle>
              </DialogHeader>
              <div className="flex justify-center py-6">
                <Loader2 className="size-8 animate-spin text-[#E86A2C]" aria-hidden="true" />
              </div>
            </>
          ) : null}

          {step === "placed" && order ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="size-5 text-[#3DD68C]" aria-hidden="true" />
                  Commande créée
                </DialogTitle>
              </DialogHeader>

              <div className="rounded-xl border border-[#2A2A2A] p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Commande
                </p>
                <p className="mt-1 font-mono text-sm">#{order.id}</p>
                <div className="mt-3 border-t border-[#2A2A2A] pt-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{order.package_name}</span>
                    <span>{order.tokens} token{order.tokens > 1 ? "s" : ""}</span>
                  </div>
                  <div className="mt-1 flex justify-between font-medium">
                    <span className="text-muted-foreground">Montant à payer</span>
                    <span>{formatFCFA(order.price_fcfa)}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 rounded-xl bg-[#1E1E1E] p-4 text-sm leading-relaxed text-muted-foreground">
                <p>
                  Envoyez <strong className="font-semibold">{formatFCFA(order.price_fcfa)}</strong> sur
                  votre moyen de paiement habituel (Wave, Orange Money ou Max It) en
                  mentionnant votre numéro de commande <strong className="font-mono">#{order.id}</strong>.
                </p>
                <p>
                  Notre équipe confirme manuellement le paiement et crédite vos
                  Tokens — le statut est visible dans votre tableau de bord.
                </p>
              </div>

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
                    <Link href="/dashboard">
                      Suivre ma commande
                      <ExternalLink className="size-4" aria-hidden="true" />
                    </Link>
                  }
                />
              </DialogFooter>
            </>
          ) : null}

          {step === "error" ? (
            <>
              <DialogHeader>
                <DialogTitle>Commande impossible</DialogTitle>
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
                <Button
                  variant="outline"
                  className="h-9"
                  onClick={createOrder}
                >
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