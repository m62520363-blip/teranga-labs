import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NotificationsPage } from "@/components/notifications-page";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Vos messages, devis et alertes sur TERANGA LABS.",
};

export const dynamic = "force-dynamic";

export default async function NotificationsRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <NotificationsPage userId={user.id} />;
}