import { createHash, timingSafeEqual } from "crypto";
import { getPaydunyaConfig } from "@/lib/payments/paydunya-config";

/**
 * Client minimal de l'API PAR (Payment And Redistribution) PayDunya.
 *
 * Différences structurantes avec Wave, à ne pas oublier :
 *   1. Authentification par 3 en-têtes (`PAYDUNYA-MASTER-KEY`,
 *      `PAYDUNYA-PRIVATE-KEY`, `PAYDUNYA-TOKEN`), pas de Bearer.
 *   2. Pas de signature HMAC sur les requêtes sortantes : la réponse
 *      elle-même porte le `hash` de la MasterKey.
 *   3. La vérification d'un webhook se fait donc en comparant le
 *      SHA-512 de la MasterKey au champ `hash` reçu (cf. verifyIpnHash).
 *   4. Les endpoints diffèrent entre `test` et `live` : le segment
 *      `/sandbox-api/` n'existe qu'en test. Se tromper de base en
 *      production fait échouer la création de facture.
 *
 * Référence : https://developers.paydunya.com/doc/EN/http_json
 */

export type PaydunyaCheckoutResponse = {
  response_code: string;
  response_text: string;
  description?: string;
  token?: string;
};

export class PaydunyaApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "PaydunyaApiError";
  }
}

export function isPaydunyaApiError(err: unknown): err is PaydunyaApiError {
  return err instanceof PaydunyaApiError;
}

/**
 * Crée une facture de paiement et retourne l'URL de redirection.
 *
 * `total_amount` est le montant réellement débité côté PayDunya : les
 * `items` sont purement décoratifs (la doc est explicite là-dessus), donc
 * le total doit venir du serveur, jamais du client.
 *
 * La référence d'intention de paiement transite via `custom_data` : c'est
 * le seul moyen de retrouver l'intention à l'arrivée de l'IPN, l'IPN ne
 * renvoyant pas de champ « référence client » au sens Wave.
 */
export async function createPaydunyaCheckout(params: {
  amountFcfa: number;
  description: string;
  itemName: string;
  itemQuantity: number;
  customData: Record<string, string>;
  returnUrl?: string;
  cancelUrl?: string;
  callbackUrl?: string;
  /** Origine publique du site, pour `store.logo_url`. */
  siteUrl?: string;
  customer?: { name?: string; email?: string; phone?: string };
  channels?: string[];
}): Promise<{ token: string; redirectUrl: string }> {
  const config = getPaydunyaConfig();

  const invoice: Record<string, unknown> = {
    total_amount: params.amountFcfa,
    description: params.description,
    items: {
      item_0: {
        name: params.itemName,
        quantity: params.itemQuantity,
        unit_price: String(params.amountFcfa),
        total_price: String(params.amountFcfa),
        description: params.description,
      },
    },
    custom_data: params.customData,
  };

  // `customer` ne part que s'il porte au moins un champ : un objet vide
  // n'est pas une donnée, et PayDunya peut le traiter comme une fiche
  // client sans identité. La garde est ici plutôt que chez l'appelant pour
  // qu'un nouveau point d'appel ne puisse pas l'oublier.
  if (params.customer && Object.values(params.customer).some(Boolean)) {
    invoice.customer = params.customer;
  }
  if (params.channels?.length) {
    invoice.channels = params.channels;
  }

  const actions: Record<string, string> = {};
  if (params.returnUrl) actions.return_url = params.returnUrl;
  if (params.cancelUrl) actions.cancel_url = params.cancelUrl;
  if (params.callbackUrl) actions.callback_url = params.callbackUrl;

  // `store.logo_url` est affiché sur la page de paiement PayDunya. Sans lui,
  // ils affichent une icône de marché générique : l'acheteur ne voit pas
  // la marque du marchand sur la page où il saisit ses coordonnées.
  // L'URL doit être absolue et publiquement accessible.
  const store: Record<string, unknown> = { name: "TERANGA LABS" };
  if (params.siteUrl) {
    store.logo_url = `${params.siteUrl.replace(/\/+$/, "")}/logo.png`;
  }

  const body: Record<string, unknown> = {
    invoice,
    store,
  };
  if (Object.keys(actions).length > 0) {
    body.actions = actions;
  }

  const response = await fetch(config.checkoutCreateUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "PAYDUNYA-MASTER-KEY": config.masterKey,
      "PAYDUNYA-PRIVATE-KEY": config.privateKey,
      "PAYDUNYA-TOKEN": config.token,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | PaydunyaCheckoutResponse
    | null;

  // response_code "00" = succès. On le vérifie même sur HTTP 200 : un 200
  // avec un code applicatif en erreur existe (ex. clés invalides), et on
  // ne doit pas rediriger le client vers une page de paiement morte.
  if (!response.ok || payload?.response_code !== "00") {
    throw new PaydunyaApiError(
      response.status,
      payload?.response_code ?? "paydunya_request_failed",
      payload?.response_text ?? `PayDunya API responded ${response.status}`
    );
  }

  const token = payload.token;
  const redirectUrl = payload.response_text;
  if (!token || !redirectUrl) {
    throw new PaydunyaApiError(
      response.status,
      "paydunya_missing_token",
      "PayDunya n'a renvoyé ni token ni URL de paiement."
    );
  }

  return { token, redirectUrl };
}

/**
 * Réponses de `checkout-invoice/confirm/{token}`.
 *
 * La doc (section « Checking the payment status ») indique que `status` est
 * `completed`, `cancelled` ou `failed`, et que `pending` est renvoyé sous
 * la forme `pending` : on accepte donc les quatre libellés.
 */
export type PaydunyaConfirmResult = {
  status: PaydunyaIpnStatus;
  totalAmount?: number;
  token?: string;
};

/**
 * Demande à PayDunya l'état RÉEL d'une facture.
 *
 * Pourquoi cette étape existe alors que le webhook est déjà acquitté : le
 * hash de l'IPN vaut SHA-512(MasterKey) et ne couvre PAS le contenu du
 * message (cf. verifyIpnHash). Un attaquant connaissant la MasterKey peut
 * donc forger un IPN `completed` avec un `total_amount` quelconque. Le
 * contrôle du montant côté serveur limite le dégât, mais ne l'empêche pas :
 * il suffit d'annoncer le bon montant.
 *
 * Cette fonction referme la faille : l'état et le montant sont redemandés à
 * PayDunya, dont la réponse ne peut pas être fabriquée sans les clés API.
 * Le jeton utilisé est celui que NOUS avons émis et stocké en base, jamais
 * celui fourni par l'appelant — sinon un attaquant pourrait nous faire
 * vérifier sa propre facture, payée, et faire correspondre le montant.
 */
export async function confirmPaydunyaCheckout(
  token: string
): Promise<PaydunyaConfirmResult> {
  const config = getPaydunyaConfig();

  const response = await fetch(
    `${config.checkoutConfirmBaseUrl}/${encodeURIComponent(token)}`,
    {
      method: "GET",
      headers: {
        "PAYDUNYA-MASTER-KEY": config.masterKey,
        "PAYDUNYA-PRIVATE-KEY": config.privateKey,
        "PAYDUNYA-TOKEN": config.token,
      },
      cache: "no-store",
    }
  );

  const payload = (await response.json().catch(() => null)) as
    | (PaydunyaCheckoutResponse & {
        invoice?: { total_amount?: string | number; status?: string };
        status?: string;
      })
    | null;

  if (!response.ok || payload?.response_code !== "00") {
    throw new PaydunyaApiError(
      response.status,
      payload?.response_code ?? "paydunya_confirm_failed",
      payload?.response_text ?? `PayDunya confirm a répondu ${response.status}`
    );
  }

  // La doc renvoie le statut à la racine pour `confirm`, mais certaines
  // réponses l'imbriquent sous `invoice`. On accepte les deux plutôt que de
  // rejeter un paiement légitime sur une forme de réponse différente.
  const rawStatus = payload.status ?? payload.invoice?.status;
  const status = String(rawStatus ?? "").toLowerCase() as PaydunyaIpnStatus;

  if (
    status !== "completed" &&
    status !== "pending" &&
    status !== "cancelled" &&
    status !== "failed"
  ) {
    throw new PaydunyaApiError(
      response.status,
      "paydunya_unexpected_status",
      `Statut de facture inconnu : ${String(rawStatus ?? "absent")}`
    );
  }

  const rawAmount = payload.invoice?.total_amount;
  const totalAmount =
    rawAmount === undefined || rawAmount === null
      ? undefined
      : Number(String(rawAmount).trim());

  return {
    status,
    totalAmount: Number.isFinite(totalAmount as number)
      ? (totalAmount as number)
      : undefined,
    token,
  };
}

/**
 * Vérifie le `hash` d'un IPN : SHA-512 de la MasterKey.
 *
 * La doc PayDunya (sections « Recovering the hash » et « Sample IPN
 * verification code ») définit la vérification comme
 * `$_POST['data']['hash'] === hash('sha512', MASTER_KEY)`.
 *
 * Point de vigilance assumé : contrairement au HMAC de Wave, ce hash ne
 * couvre PAS le contenu de la notification. N'importe qui connaissant la
 * MasterKey peut donc forger un IPN « completed » — c'est une faiblesse
 * du protocole, pas de cette implémentation. Le contrôle du montant
 * serveur dans la route IPN reste donc obligatoire, c'est lui qui empêche
 * un crédit frauduleux.
 */
export function verifyIpnHash(receivedHash: unknown): boolean {
  if (typeof receivedHash !== "string" || !receivedHash) return false;

  const config = getPaydunyaConfig();
  const expected = createHash("sha512").update(config.masterKey).digest("hex");

  const given = Buffer.from(receivedHash.trim().toLowerCase(), "utf8");
  const want = Buffer.from(expected.toLowerCase(), "utf8");

  if (given.length !== want.length) return false;
  return timingSafeEqual(given, want);
}

export type PaydunyaIpnStatus =
  | "completed"
  | "pending"
  | "cancelled"
  | "failed";

export type PaydunyaIpn = {
  response_code?: string;
  hash?: string;
  status?: PaydunyaIpnStatus;
  invoice?: {
    token?: string;
    total_amount?: string | number;
  };
  custom_data?: Record<string, string>;
  customer?: { name?: string; email?: string; phone?: string };
  receipt_url?: string;
  mode?: string;
  fail_reason?: string;
};

/**
 * Analyse le corps `application/x-www-form-urlencoded` de l'IPN.
 *
 * PayDunya poste toujours sous la clé racine `data`, sérialisée en JSON
 * (`data[hash]`, `data[invoice][total_amount]`, ...). Next.js ne parse
 * que le premier niveau des form-urlencoded, donc `data` arrive comme
 * une chaîne JSON qu'il faut décoder à la main.
 */
export function parseIpnFormData(
  form: Record<string, string | string[]>
): PaydunyaIpn | null {
  const raw = form.data;
  const serialized = Array.isArray(raw) ? raw[0] : raw;
  if (!serialized) return null;

  try {
    const parsed = JSON.parse(serialized) as unknown;
    // `typeof [] === "object"` : un tableau JSON passerait le test naïf.
    // On exige un vrai objet, sinon `ipn.status` serait undefined en
    // silence et l'IPN serait acquitté sans être traité.
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as PaydunyaIpn;
  } catch {
    return null;
  }
}

export function isPaymentCompleted(ipn: PaydunyaIpn): boolean {
  return ipn.status === "completed";
}

export function amountMatches(
  ipnAmount: unknown,
  expectedFcfa: number
): boolean {
  const actual = Number(String(ipnAmount ?? "").trim());
  return Number.isFinite(actual) && actual === expectedFcfa;
}
