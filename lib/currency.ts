// lib/currency.ts
export type CurrencyCode = "XOF" | "GNF"

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  XOF: "FCFA",
  GNF: "GNF",
}

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  XOF: "FCFA",
  GNF: "GNF",
}

export const DEFAULT_GNF_TO_XOF_RATE = Number(process.env.NEXT_PUBLIC_GNF_TO_XOF_RATE ?? 0.08)

export function formatAmount(
  amount: number,
  currency: CurrencyCode = "XOF",
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }
): string {
  const value = Number.isFinite(amount) ? amount : 0
  const min = options?.minimumFractionDigits ?? 0
  const max = options?.maximumFractionDigits ?? 0
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency === "GNF" ? "GNF" : "XOF",
      currencyDisplay: "code",
      minimumFractionDigits: min,
      maximumFractionDigits: max,
    })
      .format(value)
      .replace("XOF", "FCFA")
      .replace("GNF", "GNF")
  } catch {
    const label = CURRENCY_LABELS[currency]
    return value.toLocaleString("fr-FR", { minimumFractionDigits: min, maximumFractionDigits: max }) + " " + label
  }
}

export function convertGnfToXof(gnfAmount: number, rate: number = DEFAULT_GNF_TO_XOF_RATE): number {
  if (!Number.isFinite(gnfAmount) || gnfAmount <= 0) return 0
  if (!Number.isFinite(rate) || rate <= 0) return 0
  return Math.round(gnfAmount * rate)
}

export function convertXofToGnf(xofAmount: number, rate: number = DEFAULT_GNF_TO_XOF_RATE): number {
  if (!Number.isFinite(xofAmount) || xofAmount <= 0) return 0
  if (!Number.isFinite(rate) || rate <= 0) return 0
  return Math.round(xofAmount / rate)
}
