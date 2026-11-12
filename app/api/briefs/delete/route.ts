import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ code: "DB_NOT_CONFIGURED", message: "Service indisponible." }, { status: 503 });
  }

  const rl = rateLimit(`brief-delete:${clientIp(request)}`, 5);
  if (!rl.ok) {
    return NextResponse.json({ code: "RATE_LIMITED", message: "Trop de demandes." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ code: "BAD_REQUEST", message: "Corps invalide." }, { status: 400 });
  }

  const managementKey = typeof body.managementKey === "string" ? body.managementKey.trim() : "";
  if (!managementKey) {
    return NextResponse.json({ code: "BAD_REQUEST", message: "Clé de gestion requise." }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ code: "DB_NOT_CONFIGURED", message: "Base indisponible." }, { status: 503 });
  }

  const { data, error } = await supabase.rpc("delete_brief" as never, {
    p_management_key: managementKey,
  } as never);

  if (error) {
    return NextResponse.json({ code: "DELETE_FAILED", message: error.message || "Impossible de supprimer le projet." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, ...(data as Record<string, unknown>) });
}
