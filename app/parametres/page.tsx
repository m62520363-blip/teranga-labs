import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { SettingsContent } from "@/components/settings-content";

export const metadata: Metadata = {
  title: "Paramètres",
  description: "Gérez votre compte et votre mot de passe TERANGA LABS.",
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  if (!supabase) {
    return (
      <div className="bg-[#0F0F0F] py-16">
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
    />
  );
}