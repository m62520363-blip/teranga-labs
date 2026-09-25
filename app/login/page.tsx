import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { getCurrentRole, getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Se connecter",
  description:
    "Connectez-vous à TERANGA LABS, en tant que client ou développeur.",
};

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const [user, role] = await Promise.all([getCurrentUser(), getCurrentRole()]);
  if (user) redirect(role === "client" ? "/client" : "/dashboard");

  const params = await searchParams;
  const mode = params.mode === "signup" ? "signup" : "login";

  return <AuthShell mode={mode} />;
}