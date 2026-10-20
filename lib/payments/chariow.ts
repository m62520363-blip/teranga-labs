import { createHmac, timingSafeEqual } from "crypto";
import { getChariowConfig } from "@/lib/payments/chariow-config";
import { COUNTRIES } from "@/lib/countries";

/**
 * Client minimal de l'API Chariow (checkout + ventes + Pulses).
 *
 * Points structurants de l'intégration, à ne pas oublier :
 *   1. Authentification Bearer (`sk_...`), portée par des scopes choisis à
 *      la création de la clé (`checkout.write` + `sales.read` ici).
 *   2. Le prix vient TOUJOURS du produit côté Chariow : notre serveur ne
 *      fera que comparer le montant confirmé à l'intention gelée en base.
 *   3. Les Pulses (webhooks) sont signées HMAC-SHA256 sur le corps BRUT
 *      (`x-chariow-signature`), sans horodatage : la déduplication repose
 *      sur `x-pulse-delivery-id` et l'idempotence des RPC de crédit.
 *   4. La source de vérité d'un paiement, c'est `GET /v1/sales/{id}`
 *      (re-vérification serveur), jamais le corps du webhook seul.
 *
 * Référence : https://chariow.dev/fr/guides/checkout
 */

export class ChariowApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "ChariowApiError";
  }
}

export function isChariowApiError(err: unknown): err is ChariowApiError {
  return err instanceof ChariowApiError;
}

export type ChariowAmount = {
  value: number;
  currency: string;
  formatted?: string;
  short?: string;
};

export type ChariowSale = {
  id: string;
  status: string;
  amount?: ChariowAmount | null;
  original_amount?: ChariowAmount | null;
  payment?: { status?: string | null; amount?: ChariowAmount | null } | null;
  custom_metadata?: Record<string, string> | null;
};

export type ChariowCheckoutStep = "payment" | "completed" | "already_purchased";

export type ChariowCheckoutResult = {
  step: ChariowCheckoutStep;
  saleId: string | null;
  checkoutUrl: string | null;
  message: string | null;
  /** Montant réel de la vente (devise du produit), lu dans la réponse. */
  amount: ChariowAmount | null;
};

export type ChariowPulsePayload = {
  event?: string;
  sale?: ChariowSale & { id?: string };
  product?: { id?: string; name?: string } | null;
  customer?: { email?: string } | null;
  store?: { id?: string } | null;
};

/**
 * Indicatifs téléphoniques vers code ISO 3166-1 alpha-2.
 * Les 9 pays du périmètre viennent de COUNTRIES ; le complément couvre
 * l'international (inscription ouverte) — sans quoi Chariow rejette le
 * checkout avec une 422 « code pays inconnu ».
 */
const EXTRA_DIAL_TO_ISO: Record<string, string> = Object.fromEntries(
  (
    "+1=US +44=GB +33=FR +49=DE +34=ES +39=IT +31=NL +32=BE +351=PT +41=CH " +
    "+43=AT +46=SE +47=NO +45=DK +358=FI +48=PL +40=RO +359=BG +380=UA " +
    "+381=RS +385=HR +386=SI +387=BA +30=GR +36=HU +420=CZ +421=SK +353=IE " +
    "+90=TR +7=RU +86=CN +81=JP +82=KR +91=IN +92=PK +880=BD +62=ID +63=PH " +
    "+66=TH +65=SG +60=MY +61=AU +64=NZ +971=AE +974=QA +966=SA +965=KW " +
    "+973=BH +968=OM +962=JO +961=LB +20=EG +254=KE +255=TZ +256=UG +234=NG " +
    "+233=GH +237=CM +240=GQ +241=GA +242=CG +243=CD +250=RW +251=ET +257=BI " +
    "+258=MZ +260=ZM +261=MG +262=RE +263=ZW +265=MW +266=LS +267=BW +268=SZ " +
    "+269=KM +212=MA +213=DZ +216=TN +218=LY +211=SS +852=HK +886=TW +84=VN " +
    "+95=MM +977=NP +94=LK +992=TJ +998=UZ +54=AR +55=BR +56=CL +57=CO " +
    "+51=PE +52=MX +58=VE +593=EC +595=PY +598=UY +591=BO"
  )
    .split(" ")
    .filter(Boolean)
    .map((pair) => {
      const [dial, iso] = pair.split("=");
      return [dial, iso] as const;
    })
);

const COUNTRIES_DIAL_TO_ISO: Record<string, string> = Object.fromEntries(
  COUNTRIES.map((country) => [country.phoneCode, country.iso2] as const)
);

/**
 * Découpe un numéro international `+<indicatif><chiffres>` en
 * `{ number, country_code }` (format attendu par POST /v1/checkout :
 * chiffres seuls + code pays ISO alpha-2).
 *
 * Retourne `null` si le numéro est absent ou si aucun indicatif connu
 * ne correspond : l'appelant doit alors refuser proprement plutôt que
 * d'inventer un pays.
 */
export function parseCustomerPhone(
  raw: string | null | undefined
): { number: string; country_code: string } | null {
  if (!raw) return null;
  const cleaned = String(raw).replace(/[\s\-().]/g, "");
  const match = /^\+(\d{7,15})$/.exec(cleaned);
  if (!match) return null;
  const digits = match[1];

  // Indicatifs à 3 chiffres d'abord (+221…), puis 2 (+33…), puis 1 (+1…).
  const map = (dial: string) =>
    COUNTRIES_DIAL_TO_ISO[dial] ?? EXTRA_DIAL_TO_ISO[dial];
  const prefix3 = `+${digits.slice(0, 3)}`;
  const prefix2 = `+${digits.slice(0, 2)}`;
  const prefix1 = `+${digits.slice(0, 1)}`;
  const iso3 = map(prefix3);
  const iso = iso3 ?? map(prefix2) ?? map(prefix1);
  if (!iso) return null;

  const national = digits.slice(iso3 ? 3 : map(prefix2) ? 2 : 1);
  if (national.length < 6) return null;
  return { number: national, country_code: iso };
}

/** Prénom / nom (requis tous les deux par l'API, max 50 caractères). */
export function splitCustomerName(
  fullName: string | null | undefined
): { first_name: string; last_name: string } {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  const first = (parts[0] ?? "Client").slice(0, 50);
  const last = (parts.length > 1 ? parts.slice(1).join(" ") : parts[0] ?? "Client").slice(
    0,
    50
  );
  return { first_name: first, last_name: last };
}

/**
 * Ouvre une session de paiement et retourne l'URL de redirection.
 *
 * `custom_metadata` est le lien entre la vente Chariow et notre intention
 * de paiement : il revient dans chaque Pulse (`sale.custom_metadata`).
 * Clés alphanumériques/underscore uniquement, 10 max, 255 caractères.
 */
export async function createChariowCheckout(params: {
  productSlug: string;
  /** Variante de prix Chariow (montants exacts : missions, etc.). */
  priceVariantId?: string | null;
  email: string;
  fullName?: string | null;
  /** Numéro international brut (`+22177…`), déjà contrôlé par l'appelant. */
  phone: string;
  redirectUrl: string;
  metadata: Record<string, string>;
  customerIp?: string | null;
  /** Devise de paiement forcée : l'intention est gelée en XOF. */
  paymentCurrency?: string;
}): Promise<ChariowCheckoutResult> {
  const config = getChariowConfig();
  const phone = parseCustomerPhone(params.phone);
  if (!phone) {
    throw new ChariowApiError(
      400,
      "chariow_invalid_phone",
      "Numéro de téléphone invalide pour le checkout Chariow."
    );
  }
  const { first_name, last_name } = splitCustomerName(params.fullName);

  const body: Record<string, unknown> = {
    product_id: params.productSlug,
    email: params.email,
    first_name,
    last_name,
    phone,
    payment_currency: params.paymentCurrency ?? "XOF",
    redirect_url: params.redirectUrl,
    custom_metadata: params.metadata,
  };
  if (params.priceVariantId) body.price_variant_id = params.priceVariantId;
  if (params.customerIp) body.customer_ip = params.customerIp;

  const response = await fetch(`${config.baseUrl}/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        message?: string;
        errors?: Record<string, string[]>;
        data?: {
          step?: string;
          message?: string | null;
          purchase?: {
            id?: string;
            status?: string;
            amount?: ChariowAmount | null;
          } | null;
          payment?: { checkout_url?: string | null } | null;
        };
      }
    | null;

  if (!response.ok || !payload?.data) {
    const fieldErrors = payload?.errors ? Object.keys(payload.errors)[0] : undefined;
    throw new ChariowApiError(
      response.status,
      fieldErrors ? `chariow_field_${fieldErrors}` : "chariow_request_failed",
      payload?.message ?? `Chariow API a répondu ${response.status}.`
    );
  }

  const step = String(payload.data.step ?? "");
  if (step !== "payment" && step !== "completed" && step !== "already_purchased") {
    throw new ChariowApiError(
      response.status,
      "chariow_unexpected_step",
      `Étape de checkout inconnue : ${step || "absente"}`
    );
  }

  const saleId = payload.data.purchase?.id ?? null;
  const checkoutUrl = payload.data.payment?.checkout_url ?? null;
  if (step === "payment" && (!saleId || !checkoutUrl)) {
    throw new ChariowApiError(
      response.status,
      "chariow_missing_redirect",
      "Chariow n'a renvoyé ni vente ni URL de paiement."
    );
  }

  return {
    step,
    saleId,
    checkoutUrl,
    message: payload.data.message ?? null,
    amount: payload.data.purchase?.amount ?? null,
  };
}

/**
 * Re-vérification serveur : l'état et le montant RÉELS d'une vente,
 * demandés à Chariow avec notre clé API. C'est cette réponse qui fait
 * foi avant tout crédit — jamais le corps du webhook seul.
 */
export async function getChariowSale(saleId: string): Promise<ChariowSale> {
  const config = getChariowConfig();
  const response = await fetch(
    `${config.baseUrl}/sales/${encodeURIComponent(saleId)}`,
    {
      headers: { Authorization: `Bearer ${config.apiKey}` },
      cache: "no-store",
    }
  );

  const payload = (await response.json().catch(() => null)) as
    | { message?: string; data?: ChariowSale }
    | ChariowSale
    | null;

  if (!response.ok || !payload) {
    throw new ChariowApiError(
      response.status,
      "chariow_sale_fetch_failed",
      (payload as { message?: string } | null)?.message ??
        `Chariow GET /sales/${saleId} a répondu ${response.status}.`
    );
  }

  // Le point « vente unique » renvoie l'objet sous `data` (et la liste
  // sous `data[]`) : on accepte les deux formes plutôt que de rejeter un
  // paiement légitime.
  const sale =
    "data" in payload && payload.data
      ? (payload.data as ChariowSale)
      : (payload as ChariowSale);
  if (!sale.id) {
    throw new ChariowApiError(
      502,
      "chariow_sale_malformed",
      "Réponse Chariow sans identifiant de vente."
    );
  }
  return sale;
}

/** `completed` = payé ; `settled` = payé puis réglé — les deux créditent. */
export function isSaleCompleted(sale: Pick<ChariowSale, "status">): boolean {
  return sale.status === "completed" || sale.status === "settled";
}

/**
 * Le montant confirmé par Chariow doit être STRICTEMENT égal au montant
 * gelé côté serveur, dans la même devise (intention toujours en XOF).
 */
export function amountMatchesSale(
  sale: ChariowSale,
  expectedFcfa: number
): boolean {
  const amount = sale.amount;
  if (!amount || amount.currency !== "XOF") return false;
  return Number.isFinite(amount.value) && amount.value === expectedFcfa;
}

/**
 * Vérifie la signature d'un Pulse : HMAC-SHA256 du corps BRUT avec le
 * secret du Pulse (`whsec_...`), comparé en temps constant.
 *
 * Seul le corps brut est signé : ne JAMAIS re-sérialiser le JSON parsé
 * avant comparaison (les échappements `\/` et `\uXXXX` casseraient
 * l'empreinte). Tout header absent ou de schéma inconnu → faux.
 */
export function verifyPulseSignature(
  rawBody: string,
  received: string | null | undefined
): boolean {
  const config = getChariowConfig();
  if (!config.pulseSecret || !received || !received.startsWith("sha256=")) {
    return false;
  }

  const expected =
    "sha256=" +
    createHmac("sha256", config.pulseSecret).update(rawBody, "utf8").digest("hex");

  const given = Buffer.from(received.trim(), "utf8");
  const want = Buffer.from(expected, "utf8");
  if (given.length !== want.length) return false;
  return timingSafeEqual(given, want);
}

/** Métadonnées de référence d'une vente (lien vers notre intention). */
export function getPulseReference(
  sale: Pick<ChariowSale, "custom_metadata"> | null | undefined
): { reference: string | null; kind: "token" | "verification" | "mission" } {
  const meta = sale?.custom_metadata ?? {};
  const reference = typeof meta.reference === "string" ? meta.reference : null;
  const kind =
    meta.kind === "verification"
      ? "verification"
      : meta.kind === "mission"
        ? "mission"
        : "token";
  return { reference, kind };
}
