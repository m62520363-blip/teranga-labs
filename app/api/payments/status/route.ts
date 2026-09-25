import { NextResponse } from "next/server";
import { getCurrentUser, createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/payments/status?intent=<uuid>
 * Statut d'une intention de paiement pour le développeur connecté
 * (lecture de SES OWN intents uniquement — RLS).
 */
export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { code: "DB_NOT_CONFIGURED", message: "Base Supabase indisponible." },
      { status: 503 }
    );
  }

  const intentId = new URL(request.url).searchParams.get("intent");
  if (!intentId) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "Paramètre intent manquant." },
      { status: 400 }
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", message: "Connectez-vous." },
      { status: 401 }
    );
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json(
      { code: "DB_NOT_CONFIGURED", message: "Base Supabase indisponible." },
      { status: 503 }
    );
  }

  const { data: intent, error } = await supabase
    .from("payment_intents")
    .select("id, package_name, tokens, amount_fcfa, status, created_at, credited_at")
    .eq("id", intentId)
    .maybeSingle();

  if (error || !intent) {
    return NextResponse.json(
      { code: "INTENT_NOT_FOUND", message: "Aucune commande trouvée." },
      { status: 404 }
    );
  }

  return NextResponse.json({ intent });
}