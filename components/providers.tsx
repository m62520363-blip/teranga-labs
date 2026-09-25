"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { BalanceProvider } from "@/components/balance-provider";
import { Toaster } from "@/components/ui/sonner";

export function Providers({
  isAuthed,
  children,
}: {
  isAuthed: boolean;
  children: ReactNode;
}) {
  return (
    <ThemeProvider
      attribute="class"
      forcedTheme="light"
      disableTransitionOnChange
    >
      <BalanceProvider isAuthed={isAuthed}>{children}</BalanceProvider>
      <Toaster position="bottom-right" richColors closeButton />
    </ThemeProvider>
  );
}