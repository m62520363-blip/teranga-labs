import type { Metadata } from "next";
import { NotificationsPage } from "@/components/notifications-page";
import { requireUser } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Vos alertes TERANGA LABS.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function NotificationsRoute() {
  const user = await requireUser();
  return <NotificationsPage userId={user.id} />;
}