/**
 * Devises du monde : conversion depuis les FCFA (devise interne du prix).
 *
 * Les taux sont STATIQUES et INDICATIFS (ordre de grandeur début 2026,
 * ancrés sur le dollar). Ils servent à l'affichage « prix local » de l'espace
 * Tokens — la facturation reste toujours en FCFA (colonnes *_fcfa).
 *
 * Le symbole et le nombre de décimales viennent d'`Intl.NumberFormat`
 * (ISO 4217 complet) : inutile de les coder en dur ici.
 */

/** 1 FCFA = `rate` unités de la devise (taux indicatif statique). */
const RATES_PER_FCFA: Record<string, number> = {
  // Ancrages : EUR et XAF sont peggés à l'euro (1 EUR = 655,957 XOF).
  EUR: 0.00152449,
  XOF: 1,
  XAF: 1,
  XPF: 0.00277345, // 1 EUR = 1 193,31 XPF → 655,957 / 1 193,31

  USD: 0.00165,
  GBP: 0.001304,
  CHF: 0.001452,
  CAD: 0.0022605,
  AUD: 0.002508,
  NZD: 0.002739,

  // Asie
  JPY: 0.2475,
  CNY: 0.011715,
  KRW: 2.31,
  TWD: 0.05115,
  HKD: 0.01287,
  MOP: 0.01325,
  SGD: 0.002145,
  MYR: 0.00693,
  THB: 0.053625,
  VND: 4.323, // 2 620 ₫ / USD
  IDR: 2.7225, // 16 500 Rp / USD
  PHP: 0.0957,
  INR: 0.1452,
  PKR: 0.462,
  BDT: 0.2013,
  NPR: 0.23232, // peg 1,6 NPR/INR
  BTN: 0.1452, // peg INR
  LKR: 0.495,
  MVR: 0.02541,
  AFN: 0.1122,
  KZT: 0.891,
  UZS: 20.79,
  KGS: 0.14355,
  TJS: 0.015015,
  TMT: 0.005775,
  AZN: 0.002805,
  GEL: 0.004455,
  AMD: 0.627,
  MNT: 5.94,
  LAK: 35.805,
  KHR: 6.6825,
  MMK: 3.465,
  BND: 0.002145, // peg SGD

  // Moyen-Orient
  ILS: 0.005445,
  SAR: 0.0061875,
  AED: 0.0060555,
  QAR: 0.006006,
  KWD: 0.00050325,
  BHD: 0.0006204,
  OMR: 0.00063525,
  JOD: 0.00116985, // peg
  LBP: 147.675, // 89 500 LBP / USD
  IRR: 146.85, // 89 000 IRR / USD
  SYP: 16.5,
  YER: 0.4125,
  IQD: 2.1615,
  TRY: 0.0693,

  // Europe hors zone euro
  SEK: 0.015675,
  NOK: 0.0165,
  DKK: 0.0113733, // peg EUR (7,46038 DKK/EUR)
  ISK: 0.22275,
  PLN: 0.006105,
  CZK: 0.03465,
  HUF: 0.561,
  RON: 0.00759,
  BGN: 0.0029817, // peg EUR (1,95583 BGN/EUR)
  BAM: 0.0029817, // peg EUR (1,95583 BAM/EUR)
  ALL: 0.15245, // ~100 ALL / EUR
  MKD: 0.09375, // ~61,5 MKD / EUR
  RUB: 0.132,
  UAH: 0.06765,
  BYN: 0.00528,
  MDL: 0.02805,
  RSD: 0.0165, // ~100 RSD / EUR indicatif

  // Afrique
  GNF: 14.2725, // 8 650 GNF / USD
  NGN: 0.00165 * 1500,
  GHS: 0.020625,
  KES: 0.21285,
  UGX: 5.94,
  TZS: 4.29,
  RWF: 2.376,
  BIF: 4.785,
  CDF: 4.785,
  SOS: 0.9405,
  DJF: 0.29205, // peg
  KMF: 0.7425,
  ERN: 0.02475,
  STN: 0.0363,
  GMD: 0.1155,
  SLE: 0.037125,
  LRD: 0.32175,
  CVE: 0.16665, // peg EUR
  MZN: 0.1056,
  MWK: 2.8545,
  ZMW: 0.0396,
  ZWL: 0.04125,
  ZAR: 0.028875,
  BWP: 0.022275,
  NAD: 0.028875, // peg ZAR
  SZL: 0.028875, // peg ZAR
  LSL: 0.028875, // peg ZAR
  MGA: 7.425,
  MUR: 0.075075,
  SCR: 0.0231,
  MRU: 0.066,
  ETB: 0.231,
  SSP: 6.27,
  SDG: 0.99,
  EGP: 0.0792,
  MAD: 0.016335,
  TND: 0.005115,
  DZD: 0.21945,
  LYD: 0.008085,
  AOA: 1.485,

  // Amériques
  BRL: 0.00891,
  MXN: 0.030525,
  ARS: 2.3925,
  CLP: 1.5675,
  COP: 6.93,
  PEN: 0.0061875,
  UYU: 0.066,
  BOB: 0.011385,
  PYG: 12.045,
  VES: 0.594,
  GTQ: 0.012705,
  CRC: 0.8415,
  HNL: 0.04125,
  NIO: 0.06105,
  PAB: 0.00165,
  SVC: 0.0144375,
  DOP: 0.099,
  HTG: 0.2145,
  JMD: 0.25575,
  TTD: 0.01122,
  GYD: 0.33825,
  SRD: 0.066,
  CUP: 0.0396,
  BZD: 0.0033165,
  BBD: 0.0033,
  BSD: 0.00165,
  BMD: 0.00165, // peg USD
  KYD: 0.00132, // 0,80 KYD / USD (peg)
  XCD: 0.004455, // peg USD (2,70 XCD/USD)

  // Océanie
  FJD: 0.00363,
  PGK: 0.006765,
  VUV: 0.1947,
  WST: 0.004455,
  TOP: 0.003795,
  SBD: 0.013695,
  KPW: 1.485, // 900 KPW / USD (indicatif, taux officiel figé)
};

/** Tous les codes devise connus (ISO 4217) du référentiel monde. */
export const CURRENCY_CODES: readonly string[] = Object.freeze(
  Object.keys(RATES_PER_FCFA)
);

export function isKnownCurrency(code: string | null | undefined): boolean {
  if (!code) return false;
  return Object.prototype.hasOwnProperty.call(RATES_PER_FCFA, code);
}

/** Taux indicatif : 1 FCFA vaut `rate` unités de `code`. */
export function ratePerFcfa(code: string | null | undefined): number | null {
  if (!code) return null;
  const rate = RATES_PER_FCFA[code];
  return typeof rate === "number" ? rate : null;
}

/** Conversion : montant FCFA → montant en devise `code` (non arrondi). */
export function convertFcfa(fcfa: number, code: string | null | undefined): number | null {
  const rate = ratePerFcfa(code);
  if (rate === null || !Number.isFinite(fcfa)) return null;
  return fcfa * rate;
}

/**
 * Prix FCFA affiché dans la devise locale, via Intl (symbole + décimales
 * ISO 4217 officiels pour la locale). Ex. :
 *   formatLocalPrice(2500, "USD")            → « 4,13 $US » (fr-FR)
 *   formatLocalPrice(2500, "USD", "en")      → « $4.13 »
 *   formatLocalPrice(2500, "XOF")            → « 2 500 F CFA »
 *   formatLocalPrice(2500, null)             → null (repli FCFA côté appelant)
 */
export function formatLocalPrice(
  fcfa: number,
  code: string | null | undefined,
  locale = "fr-FR"
): string | null {
  const amount = convertFcfa(fcfa, code);
  if (amount === null) return null;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code as string,
      maximumFractionDigits: amount !== 0 && Math.abs(amount) < 100 ? 2 : 0,
    }).format(amount);
  } catch {
    // Code devise inconnu d'Intl (ne devrait pas arriver : ISO 4217).
    return null;
  }
}
