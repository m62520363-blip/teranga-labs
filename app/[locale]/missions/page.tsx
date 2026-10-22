import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";
import {
  MissionsDashboard,
  type DisputeRow,
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
  const user = await requireUser();

  const supabase = await createClient();
  if (!supabase) {
    return (
      <div className="bg-surface py-16">
        <div className="container-tl mx-auto max-w-md text-center">
          <h1 className="text-2xl font-semibold">Configuration requise</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Connexion à Supabase manquante.
          </p>
        </div>
      </div>
    );
  }

  const roleRes = await supabase.rpc("get_my_role");
  const role = typeof roleRes.data === "string" ? roleRes.data : null;

  const { data } = await supabase.rpc("list_my_missions");
  const missions = (Array.isArray(data) ? data : []) as unknown as MissionPayload[];

  // Mes litiges (F2) : demandeur ou défendeur, nés des transitions
  // « Ouvrir un litige » (open_dispute) — modération côté admin.
  const { data: disputesData } = await supabase.rpc("list_my_disputes");
  const disputes = (
    Array.isArray(disputesData) ? disputesData : []
  ) as unknown as DisputeRow[];

  const params = (await searchParams) ?? {};
  const focusId = typeof params.focus === "string" && params.focus ? params.focus : null;

  return (
    <MissionsDashboard
      missions={missions}
      userId={user.id}
      role={role}
      focusId={focusId}
      disputes={disputes}
    />
  );
}