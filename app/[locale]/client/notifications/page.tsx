import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";
import { NotificationsPage } from "@/components/notifications-page";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Vos notifications Devmarket.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ClientNotificationsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) redirect("/login");

  const roleRes = await supabase.rpc("get_my_role");
  if (roleRes.data !== "client") redirect("/dashboard");

  return (
    <div className="bg-surface py-6 md:py-10">
      <div className="container-tl">
        <NotificationsPage userId={user.id} />
      </div>
    </div>
  );
}
