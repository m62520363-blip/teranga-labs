import { NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { improveBriefDescription } from "@/lib/ai/brief-assistant";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ai/brief-assist
 * Améliore une description de brief, via LLM optionnel (AI_API_KEY)
 * sinon via les règles locales. Accessible sans authentification,
 * avec une limite de débit par IP (10 par minute).
 */
export async function POST(request: Request) {
  const rl = rateLimit(`ai-brief-assist:${clientIp(request)}`, 10);
  if (!rl.ok) {
    return NextResponse.json(
      { code: "RATE_LIMITED", message: "Trop de demandes, patientez un instant." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "Corps de requête invalide." },
      { status: 400 }
    );
  }

  const description =
    typeof body === "object" && body !== null && "description" in body
      ? (body as { description: unknown }).description
      : "";
  if (typeof description !== "string" || !description.trim()) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "Description manquante." },
      { status: 400 }
    );
  }

  try {
    const result = await improveBriefDescription(description);
    return NextResponse.json(result);
  } catch (error) {
    log.error({
      action: "ai.brief_assist",
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { code: "SERVER_ERROR", message: "L'assistant est indisponible." },
      { status: 500 }
    );
  }
}