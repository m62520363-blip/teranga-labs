import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/log";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get("next") ?? "/briefs";
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const redirectTo = `${origin}${next.startsWith("/") ? next : "/briefs"}`;

  if (code || (tokenHash && type)) {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.redirect(
        `${origin}/login?error=Supabase non configuré`
      );
    }

    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        type: type as EmailOtpType,
        token_hash: tokenHash,
      });
      if (!error) {
        // F3 : premier email confirmé du compte = inscription terminée
        // (les deux funnels client et développeur passent par ce lien).
        if (type === "signup") {
          void (async () => {
            try {
              const { data: userData } = await supabase.auth.getUser();
              const uid = userData.user?.id;
              const admin = uid ? createAdminClient() : null;
              if (!admin) return;
              const { error: trackError } = await admin.rpc("track_event", {
                p_event: "signup_completed",
                p_actor_id: uid,
              });
              if (trackError) {
                log.error({ action: "track.signup_completed", message: trackError.message });
              }
            } catch (err) {
              log.error({
                action: "track.signup_completed",
                message: err instanceof Error ? err.message : String(err),
              });
            }
          })();
        }
        return NextResponse.redirect(redirectTo);
      }
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(redirectTo);
    }

    return NextResponse.redirect(
      `${origin}/login?error=Votre lien de vérification est invalide ou expiré.`
    );
  }

  return NextResponse.redirect(`${origin}/login`);
}