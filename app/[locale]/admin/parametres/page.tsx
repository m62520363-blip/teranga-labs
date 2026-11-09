import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { Settings } from "lucide-react";

export const metadata: Metadata = {
  title: "Paramètres admin",
  description: "Configuration de la plateforme Devmarket.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireRole(["admin"]);

  const supabase = await createClient();
  let settings: Record<string, unknown> | null = null;

  if (supabase) {
    const { data } = await supabase.rpc("admin_get_mission_payment_config");
    if (data && typeof data === "object") {
      settings = data as Record<string, unknown>;
    }
  }

  return (
    <div className="bg-surface py-10 md:py-16">
      <div className="container-tl max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Configuration de la plateforme.
          </p>
        </div>

        <div className="rounded-2xl border border-hairline bg-card p-6">
          <h2 className="text-base font-semibold">Configuration paiement missions</h2>
          {settings ? (
            <pre className="mt-4 overflow-auto rounded-xl bg-muted p-4 text-xs text-muted-foreground">
              {JSON.stringify(settings, null, 2)}
            </pre>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Aucune configuration disponible.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
