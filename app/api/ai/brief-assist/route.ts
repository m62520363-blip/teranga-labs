import { NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import {
  improveBriefDescription,
  type AssistMode,
} from "@/lib/ai/brief-assistant";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_MODES = new Set<AssistMode>([
  "generate",
  "rewrite",
  "correct",
  "improve",
  "simplify",
]);

/**
 * POST /api/ai/brief-assist
 * Assistant IA de rédaction de briefs (Section E) :
 *   - Compréhension, informations manquantes, questions intelligentes,
 *     titre, description, fonctionnalités, compétences, budget indicatif,
 *     délai indicatif, livrables attendus.
 *   - Modes : generate | rewrite | correct | improve | simplify.
 *   - 100 % gratuit pour tous les clients.
 */
export async function POST(request: Request) {
  const rl = rateLimit(`ai-brief-assist:${clientIp(request)}`, 15);
  if (!rl.ok) {
    return NextResponse.json(
      { code: "RATE_LIMITED", message: "Trop de demandes, patientez un instant." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "Corps de requête invalide." },
      { status: 400 }
    );
  }

  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  if (!description) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "Description manquante." },
      { status: 400 }
    );
  }

  const rawMode = typeof body.mode === "string" ? (body.mode as AssistMode) : "improve";
  const mode: AssistMode = VALID_MODES.has(rawMode) ? rawMode : "improve";

  const answers: Record<string, string> = {};
  if (body.answers && typeof body.answers === "object") {
    for (const [k, v] of Object.entries(body.answers as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) {
        answers[k] = v.trim().slice(0, 500);
      }
    }
  }

  try {
    const result = await improveBriefDescription(description, mode, answers);
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
