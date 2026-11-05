"use client";

import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BalanceProvider } from "@/components/balance-provider";
import { Toaster } from "@/components/ui/sonner";
import { CookieConsent } from "@/components/cookie-consent";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchOnWindowFocus: false },
  },
});

/**
 * Le site n'a qu'un seul thème (sombre). L'ancien `ThemeProvider` de
 * `next-themes` injectait un script et une balise `<style>` dans `<html>`
 * avant l'hydratation, ce qui provoquait par intermittence une erreur
 * d'hydratation React (#418) et une régénération de l'arbre côté client.
 * Le thème étant fixe, ces providers se limitent au solde et aux toasts.
 */
export function Providers({
  isAuthed,
  children,
}: {
  isAuthed: boolean;
  children: ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <BalanceProvider isAuthed={isAuthed}>
        {children}
        <CookieConsent />
        <Toaster position="bottom-right" richColors closeButton />
      </BalanceProvider>
    </QueryClientProvider>
  );
}
