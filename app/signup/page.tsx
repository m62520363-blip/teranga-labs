import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Créer un compte",
  description:
    "Inscrivez-vous sur TERANGA LABS : publiez un projet (client) ou débloquez les briefs et contactez les clients (développeur).",
};

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect("/client");

  redirect("/login?mode=signup");
}