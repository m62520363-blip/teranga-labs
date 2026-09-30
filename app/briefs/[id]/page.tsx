import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, MapPin, Sparkles, Timer } from "lucide-react";
import {
  createClient,
  getCurrentUser,
} from "@/lib/supabase/server";
import { UnlockDialog } from "@/components/unlock-dialog";
import { formatFCFA, formatDate } from "@/lib/formatting";
import { PROJECT_TYPE_LABELS } from "@/lib/tokens";
import { cn } from "cn";

export const dynamic = "force-dynamic";

type BriefDetail = {
  id: string;
  client_name: string;
  client_city: string;
  project_type: string;
  budget: number;
  description: string;
  demo: boolean;
  budget_verified: boolean;
  created_at: string;
  features: string[] | null;
  deadline: string | null;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) return { title: "Brief développeur" };

  const { data } = await supabase
    .from("requests")
    .select("client_name, project_type, budget, client_city")
    .eq("id", id)
    .eq("status", "ouvert")
    .eq("hidden", false)
    .maybeSingle();

  if (!data) return { title: "Brief développeur" };

  return {
    title: `${data.client_name} — Brief développeur`,
    description: `${PROJECT_TYPE_LABELS[data.project_type] ?? data.project_type} · ${data.client_city} · Budget ${formatFCFA(data.budget)}. Débloquez le contact pour proposer votre service.`,
  };
}

export default async function BriefDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser();

  let brief: BriefDetail | null = null;

  let conversationId: string | null = null;
  let balance: number | null = null;

  if (supabase) {
    const { data } = await supabase
      .from("requests")
      .select(
        "id, client_name, client_city, project_type, budget, description, status, hidden, budget_verified, demo, created_at, features, deadline"
      )
      .eq("id", id)
      .eq("status", "ouvert")
      .eq("hidden", false)
      .maybeSingle();

    brief = (data as BriefDetail | null) ?? null;

    if (brief && user && !brief.demo) {
      const { data: unlocks } = await supabase.rpc("get_my_unlocks");
      for (const row of Array.isArray(unlocks) ? unlocks : []) {
        const entry = row as { request_id?: string };
        if (entry.request_id === id) {
          const { data: conv } = await supabase
            .from("conversations")
            .select("id")
            .eq("developer_id", user.id)
            .eq("request_id", id)
            .maybeSingle();
          conversationId = (conv?.id as string | null) ?? null;
        }
      }
      const { data: balanceData } = await supabase.rpc("get_token_balance");
      if (typeof balanceData === "number") balance = balanceData;
    }
  }

  if (!brief) notFound();

  const demo = Boolean(brief.demo);

  return (
    <div className="bg-surface py-14 md:py-20">
      <div className="container-tl">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/briefs"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Tous les briefs
          </Link>

          <div className="mt-6 rounded-2xl border border-hairline bg-card p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-6 items-center rounded-full bg-muted px-3 text-xs font-semibold uppercase tracking-wide text-foreground">
                {PROJECT_TYPE_LABELS[brief.project_type] ?? brief.project_type}
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <MapPin className="size-4" aria-hidden="true" />
                {brief.client_city}
              </span>
              {brief.budget_verified ? (
                <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-success/25 bg-card px-3 text-xs font-semibold text-success">
                  <BadgeCheck className="size-3.5" aria-hidden="true" />
                  Budget vérifié
                </span>
              ) : null}
              {demo ? (
                <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-primary/40 bg-primary-soft px-3 text-xs font-semibold text-primary">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  Exemple
                </span>
              ) : null}
            </div>

            <h1 className="mt-5 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              {brief.client_name}
            </h1>

            <p className="mt-3 text-2xl font-semibold tracking-tight">
              {formatFCFA(brief.budget)}
            </p>

            <p className="mt-5 text-base leading-relaxed text-muted-foreground">
              {brief.description}
            </p>

            {brief.features && brief.features.length > 0 ? (
              <div className="mt-7">
                <h2 className="text-sm font-semibold tracking-tight">
                  Périmètre du projet
                </h2>
                <ul className="mt-3 space-y-2">
                  {brief.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Timer className="size-4" aria-hidden="true" />
                Publié le {formatDate(brief.created_at)}
              </span>
              {brief.deadline ? (
                <span>Délai souhaité : {formatDate(brief.deadline)}</span>
              ) : null}
            </div>

            <div
              className={cn(
                "mt-8 rounded-xl border p-4",
                demo
                  ? "border-primary/40 bg-primary-soft"
                  : "border-hairline bg-muted"
              )}
            >
              {demo ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">Brief d’exemple</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      Déblocage gratuit : testez la messagerie sans dépenser de
                      Token.
                    </p>
                  </div>
                  <UnlockDialog
                    brief={{
                      id: brief.id,
                      client_name: brief.client_name,
                      project_type: brief.project_type,
                      client_city: brief.client_city,
                      budget: brief.budget,
                      description: brief.description,
                      demo: true,
                      created_at: brief.created_at,
                    }}
                    user={user ? { id: user.id } : null}
                    balance={balance}
                    conversationId={conversationId}
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">
                      Débloquer le contact pour proposer votre service
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      1 Token (2 500 F). Le client garde son WhatsApp privé.
                    </p>
                  </div>
                  <UnlockDialog
                    brief={{
                      id: brief.id,
                      client_name: brief.client_name,
                      project_type: brief.project_type,
                      client_city: brief.client_city,
                      budget: brief.budget,
                      description: brief.description,
                      demo: false,
                      created_at: brief.created_at,
                    }}
                    user={user ? { id: user.id } : null}
                    balance={balance}
                    conversationId={conversationId}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}