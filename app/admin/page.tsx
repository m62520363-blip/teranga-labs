import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin-dashboard";
import { getCurrentUser, getCurrentRole } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Administration",
  description: "Pilotage de TERANGA LABS : briefs, développeurs et transactions.",
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const role = await getCurrentRole();
  if (role !== "admin") redirect("/");

  return <AdminDashboard />;
}