/**
 * Limitation de débit en mémoire (§32, audit C6).
 *
 * Fenêtre glissante simple (IP + nom de route). Idéal pour absorber
 * les abus raisonnables avant un vrai cache distribué (Upstash/Redis)
 * : sur Vercel, chaque instance garde son propre compteur — suffisant
 * pour dissuader, à remplacer par un store partagé à la montée en
 * charge. Les valeurs par défaut correspondent au trafic réel constaté.
 */

const WINDOW_MS = 60_000;

interface Bucket {
  windowStart: number;
  hits: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds?: number;
  remaining: number;
}

export function rateLimit(
  key: string,
  limit = 20,
  windowMs = WINDOW_MS
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { windowStart: now, hits: 1 });
    return { ok: true, remaining: limit - 1 };
  }

  if (bucket.hits >= limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((windowMs - (now - bucket.windowStart)) / 1000)
    );
    return { ok: false, retryAfterSeconds, remaining: 0 };
  }

  bucket.hits += 1;
  return { ok: true, remaining: limit - bucket.hits };
}

export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}