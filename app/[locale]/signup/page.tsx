import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { getCurrentRole, getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Créer un compte",
  description:
    "Inscrivez-vous sur Devmarket : publiez un projet (client) ou débloquez les briefs et contactez les clients (développeur).",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const [user, role] = await Promise.all([getCurrentUser(), getCurrentRole()]);
  if (user) redirect(role === "client" ? "/client" : "/dashboard");

  const params = await searchParams;
  const initialRole = params.role === "developer" ? "developer" : "client";

  return <AuthShell mode="signup" initialRole={initialRole} />;
}
