import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";
import { SettingsContent, type EmailPrefs } from "@/components/settings-content";

export const metadata: Metadata = {
  title: "Paramètres",
  description: "Gérez votre compte et votre mot de passe TERANGA LABS.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();

  const supabase = await createClient();
  if (!supabase) {
    return (
      <div className="bg-surface py-16">
        <div className="container-tl mx-auto max-w-md text-center">
          <h1 className="text-2xl font-semibold">Configuration requise</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Connexion à Supabase manquante.
          </p>
        </div>
      </div>
    );
  }

  const roleRes = await supabase.rpc("get_my_role");
  const role =
    roleRes.data === "client" || roleRes.data === "developer"
      ? roleRes.data
      : null;

  let devPublicUrl: string | null = null;
  if (role === "developer") {
    const { data } = await supabase
      .from("developers")
      .select("username")
      .eq("id", user.id)
      .maybeSingle();
    if (data?.username) devPublicUrl = `/dev/${data.username}`;
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const name = String(meta.full_name ?? "").trim() || null;
  const company = String(meta.company_name ?? "").trim() || null;
  const city = String(meta.city ?? "").trim() || null;
  const whatsapp = String(meta.whatsapp ?? "").trim() || null;

  // Source de vérité : table notification_preferences (mig 0067).
  // Fallback : ancien user_metadata.email_prefs / défauts « tout actif ».
  const { data: prefRow } = await supabase
    .from("notification_preferences")
    .select("in_app, email_contact, email_replies, email_unread_reminders, email_price_offers")
    .eq("user_id", user.id)
    .maybeSingle();

  const emailPrefs: Partial<EmailPrefs> | null = prefRow
    ? {
        contact: prefRow.email_contact,
        replies: prefRow.email_replies,
        unreadReminders: prefRow.email_unread_reminders,
        priceOffers: prefRow.email_price_offers,
      }
    : ((meta.email_prefs ?? null) as Partial<EmailPrefs> | null);
  const inAppPref = prefRow ? prefRow.in_app : true;

  return (
    <SettingsContent
      email={user.email ?? ""}
      name={name}
      role={role}
      createdAt={user.created_at}
      company={company}
      city={city}
      whatsapp={whatsapp}
      emailConfirmed={Boolean(user.email_confirmed_at)}
      lastSignIn={user.last_sign_in_at ?? null}
      devPublicUrl={devPublicUrl}
      emailPrefs={emailPrefs}
      inAppPref={inAppPref}
    />
  );
}