"use client";

import Link from "next/link";
import { Coins } from "lucide-react";
import { useBalance } from "@/components/balance-provider";

export function TokenBalance() {
  const { balance } = useBalance();

  return (
    <Link
      href="/tokens"
      title={balance === null ? "Tokens" : `${balance} token${balance > 1 ? "s" : ""} disponibles`}
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft"
      aria-label={balance === null ? "Solde de tokens" : `Solde : ${balance} tokens`}
    >
      <Coins className="size-4 text-primary" aria-hidden="true" />
      <span>{balance === null ? "—" : balance}</span>
    </Link>
  );
}