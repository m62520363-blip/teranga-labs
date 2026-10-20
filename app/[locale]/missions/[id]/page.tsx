import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";
import { MissionDetail } from "@/components/missions/mission-detail";
import type { MissionPayload } from "@/components/missions/types";

export const metadata: Metadata = {
  title: "Détail de la mission",
  description: "Suivi d'une mission TERANGA LABS.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MissionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ paid?: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const supabase = await createClient();
  if (!supabase) notFound();

  const roleRes = await supabase.rpc("get_my_role");
  const role = typeof roleRes.data === "string" ? roleRes.data : null;

  const { data } = await supabase.rpc("list_my_missions");
  const missions = (Array.isArray(data) ? data : []) as unknown as MissionPayload[];
  const mission = missions.find((m) => m.id === id);
  if (!mission) notFound();

  const params2 = (await searchParams) ?? {};
  const justPaid = typeof params2.paid === "string" && params2.paid === "1";

  return (
    <MissionDetail mission={mission} userId={user.id} role={role} justPaid={justPaid} />
  );
}
