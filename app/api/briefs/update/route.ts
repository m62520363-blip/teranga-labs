import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ code: "DB_NOT_CONFIGURED", message: "Service indisponible." }, { status: 503 });
  }

  const rl = rateLimit(`brief-update:${clientIp(request)}`, 10);
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

  const { data, error } = await supabase.rpc("update_brief_content" as never, {
    p_management_key: managementKey,
    p_client_name: typeof body.client_name === "string" ? body.client_name : null,
    p_client_whatsapp: typeof body.client_whatsapp === "string" ? body.client_whatsapp : null,
    p_project_type: typeof body.project_type === "string" ? body.project_type : null,
    p_budget: typeof body.budget === "number" ? body.budget : null,
    p_description: typeof body.description === "string" ? body.description : null,
  } as never);

  if (error) {
    return NextResponse.json({ code: "UPDATE_FAILED", message: error.message || "Impossible de modifier le projet." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, ...(data as Record<string, unknown>) });
}
