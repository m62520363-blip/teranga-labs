import { NextResponse } from "next/server";
import { apiRequireUser } from "@/lib/auth/guards";
import { createAdminClient, isServiceConfigured } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SIZE_BYTES = 4 * 1024 * 1024;
const BUCKET = "developer-assets";

export async function POST(request: Request) {
  const guard = await apiRequireUser();
  if (guard.response) return guard.response;
  const user = guard.user!;
  const rl = rateLimit(`profile-cover:${user.id}`, 10);
  if (!rl.ok) {
    return NextResponse.json(
      { code: "RATE_LIMITED", message: "Trop de demandes." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  if (!isServiceConfigured()) {
    return NextResponse.json({ code: "STORAGE_UNAVAILABLE", message: "Stockage non configuré." }, { status: 503 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ code: "STORAGE_UNAVAILABLE", message: "Stockage indisponible." }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ code: "BAD_REQUEST", message: "Fichier manquant." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ code: "BAD_REQUEST", message: "Aucun fichier reçu." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ code: "INVALID_TYPE", message: "Format accepté : JPG, PNG ou WebP." }, { status: 400 });
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ code: "FILE_TOO_LARGE", message: "Image trop lourde (4 Mo max)." }, { status: 400 });
  }

  const { data: bucket } = await admin.storage.getBucket(BUCKET);
  if (!bucket) {
    await admin.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_SIZE_BYTES });
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${user.id}/cover-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: true,
  });

  if (uploadError) {
    return NextResponse.json({ code: "UPLOAD_FAILED", message: "Téléversement échoué." }, { status: 500 });
  }

  const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);
  const url = urlData.publicUrl;

  const supabase = await (await import("@/lib/supabase/server")).createClient();
  if (supabase) {
    await supabase.rpc("update_developer_cover" as never, { p_cover_url: url } as never);
  }

  return NextResponse.json({ ok: true, url });
}
