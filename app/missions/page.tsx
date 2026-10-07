import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import {
  MissionsDashboard,
  type MissionPayload,
} from "@/components/missions/missions-dashboard";

export const metadata: Metadata = {
  title: "Mes missions",
  description: "Suivi de vos missions TERANGA LABS.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MissionsPage({
  searchParams,
}: {
  searchParams?: Promise<{ focus?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  if (!supabase) redirect("/login");

  const roleRes = await supabase.rpc("get_my_role");
  const role = typeof roleRes.data === "string" ? roleRes.data : null;

  const { data } = await supabase.rpc("list_my_missions");
  const missions = (Array.isArray(data) ? data : []) as unknown as MissionPayload[];

  const params = (await searchParams) ?? {};
  const focusId = typeof params.focus === "string" && params.focus ? params.focus : null;

  return <MissionsDashboard missions={missions} userId={user.id} role={role} focusId={focusId} />;
}