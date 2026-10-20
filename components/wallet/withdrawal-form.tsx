"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

const METHODS = [
  { value: "wave", label: "Wave" },
  { value: "orange_money", label: "Orange Money" },
  { value: "mobicash", label: "Mobicash" },
  { value: "bank_transfer", label: "Virement bancaire" },
];

export function WithdrawalForm() {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("wave");
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("request_withdrawal", {
      p_amount_fcfa: parseInt(amount, 10),
      p_method: method,
      p_destination: destination,
    });

    setLoading(false);

    if (rpcError) {
      setError(rpcError.message || "Une erreur est survenue.");
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/wallet"), 2000);
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-success/40 bg-success-soft p-6 text-center">
        <p className="text-sm font-semibold text-success">
          Demande de retrait enregistrée
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Vous allez être redirigé vers votre wallet.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="amount" className="block text-sm font-medium text-foreground">
          Montant (FCFA)
        </label>
        <input
          id="amount"
          type="number"
          min="5000"
          step="1000"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-hairline bg-surface px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/50"
          placeholder="Ex : 10000"
        />
        <p className="mt-1 text-xs text-muted-foreground">Minimum : 5 000 FCFA</p>
      </div>

      <div>
        <label htmlFor="method" className="block text-sm font-medium text-foreground">
          Moyen de retrait
        </label>
        <select
          id="method"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-hairline bg-surface px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/50"
        >
          {METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="destination" className="block text-sm font-medium text-foreground">
          Numéro / coordonnées
        </label>
        <input
          id="destination"
          type="text"
          required
          minLength={4}
          maxLength={120}
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-hairline bg-surface px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/50"
          placeholder={
            method === "bank_transfer"
              ? "IBAN ou coordonnées bancaires"
              : "Numéro de téléphone"
          }
        />
      </div>

      {error && (
        <p className="rounded-xl border border-error/30 bg-error-soft px-4 py-3 text-sm text-error">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-ink transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {loading ? "Envoi…" : "Envoyer la demande"}
      </button>
    </form>
  );
}
