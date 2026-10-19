import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { getCurrentRole, getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Se connecter",
  description:
    "Connectez-vous à TERANGA LABS, en tant que client ou développeur.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; role?: string; next?: string }>;
}) {
  const [user, role] = await Promise.all([getCurrentUser(), getCurrentRole()]);
  const params = await searchParams;
  /* `next` = retour après connexion (ex. milieu du parcours développeur) :
     chemin interne uniquement, jamais une URL externe (open redirect). */
  const rawNext = params.next;
  const next =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : null;

  if (user) redirect(next ?? (role === "client" ? "/client" : "/dashboard"));

  const mode = params.mode === "signup" ? "signup" : "login";
  const initialRole = params.role === "developer" ? "developer" : "client";

  return <AuthShell mode={mode} initialRole={initialRole} next={next} />;
}