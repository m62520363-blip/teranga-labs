"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useBalance } from "@/components/balance-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function SignOutButton({
  variant = "desktop",
}: {
  variant?: "desktop" | "mobile" | "menu";
}) {
  const router = useRouter();
  const { reset } = useBalance();
  const [open, setOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);

  const confirmSignOut = async () => {
    setSigningOut(true);
    if (isSupabaseConfigured()) {
      await createClient().auth.signOut();
    }
    reset();
    setOpen(false);
    router.push("/");
    router.refresh();
  };

  if (variant === "menu") {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={signingOut}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-destructive outline-none hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-destructive/40 disabled:opacity-60"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Se déconnecter
        </button>
        <ConfirmSignOutDialog
          open={open}
          onOpenChange={setOpen}
          signingOut={signingOut}
          onConfirm={confirmSignOut}
        />
      </>
    );
  }

  if (variant === "mobile") {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={signingOut}
          className="rounded-lg px-3 py-2 text-left text-sm font-medium text-foreground outline-none hover:bg-muted disabled:opacity-60"
        >
          Se déconnecter
        </button>
        <ConfirmSignOutDialog
          open={open}
          onOpenChange={setOpen}
          signingOut={signingOut}
          onConfirm={confirmSignOut}
        />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={signingOut}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-60"
      >
        <LogOut className="size-4" aria-hidden="true" />
        <span className="hidden lg:inline">Déconnexion</span>
      </button>
      <ConfirmSignOutDialog
        open={open}
        onOpenChange={setOpen}
        signingOut={signingOut}
        onConfirm={confirmSignOut}
      />
    </>
  );
}

function ConfirmSignOutDialog({
  open,
  onOpenChange,
  signingOut,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signingOut: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Se déconnecter ?</DialogTitle>
          <DialogDescription>
            Vous serez redirigé vers la page d’accueil. Votre compte, vos
            Tokens et vos données restent enregistrés jusqu’à votre prochaine
            connexion.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={signingOut}
          >
            Rester connecté
          </Button>
          <Button type="button" onClick={onConfirm} disabled={signingOut}>
            {signingOut ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <LogOut className="size-4" aria-hidden="true" />
            )}
            Se déconnecter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}