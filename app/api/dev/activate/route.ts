import { NextResponse } from "next/server";
import { apiRequireUser } from "@/lib/auth/guards";
import { createAdminClient, isServiceConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/dev/activate
 * Active automatiquement le compte développeur lorsque son profil obligatoire
 * est complété à 100 %, sans passage par une validation manuelle admin.
 */
export async function POST() {
  const guard = await apiRequireUser();
  if (guard.response) return guard.response;
  const user = guard.user!;

  if (!isServiceConfigured()) {
    return NextResponse.json({ ok: true, status: "active" });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: true, status: "active" });
  }

  const { data: dev } = await admin
    .from("developers")
    .select("id, full_name, bio, username, city, skills, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!dev) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const hasName = Boolean(dev.full_name?.trim());
  const hasBio = Boolean(dev.bio?.trim());
  const hasUsername = Boolean(dev.username?.trim());
  const hasCity = Boolean(dev.city?.trim());
  const hasSkills = Array.isArray(dev.skills) && dev.skills.length > 0;

  if (
    hasName &&
    hasBio &&
    hasUsername &&
    hasCity &&
    hasSkills &&
    dev.status !== "suspended" &&
    dev.status !== "verified"
  ) {
    await admin
      .from("developers")
      .update({
        status: "active",
        rejection_reason: null,
      })
      .eq("id", user.id);

    return NextResponse.json({ ok: true, status: "active" });
  }

  return NextResponse.json({ ok: true, status: dev.status });
}
