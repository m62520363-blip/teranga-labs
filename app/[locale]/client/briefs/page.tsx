import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getConversations } from "@/lib/conversations";
import { requireUser } from "@/lib/auth/guards";
import {
  ClientProjects,
  type ClientProjectItem,
} from "@/components/client-projects";

export const metadata: Metadata = {
  title: "Mes briefs",
  description: "Tous les briefs publiés sur votre compte Devmarket.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type MyRequest = {
  id: string;
  client_name: string;
  client_city: string;
  project_type: string;
  budget: number;
  description: string;
  status: string;
  features: unknown[] | null;
  deadline: string | null;
  management_key: string;
  created_at: string;
  max_unlocks: number;
  current_unlocks_count: number;
};

export default async function ClientBriefsPage() {
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
  if (roleRes.data !== "client") redirect("/dashboard");

  const [requestsRes, conversations, reviewMapRes] = await Promise.all([
    supabase.rpc("get_my_requests" as never),
    getConversations(supabase, user.id),
    supabase.rpc("get_my_request_reviews"),
  ]);

  const requests = ((requestsRes.data ?? []) as MyRequest[]).filter((r) =>
    Boolean(r.id)
  );

  const convByRequest = new Map<string, typeof conversations>();
  for (const c of conversations) {
    const arr = convByRequest.get(c.request.id) ?? [];
    arr.push(c);
    convByRequest.set(c.request.id, arr);
  }

  const reviewMap = new Map<string, { id: string; rating: number }>();
  for (const rev of (reviewMapRes.data ?? []) as {
    request_id: string;
    review_id: string;
    rating: number;
  }[]) {
    if (rev?.request_id && rev?.review_id) {
      reviewMap.set(rev.request_id, { id: rev.review_id, rating: rev.rating });
    }
  }

  const items: ClientProjectItem[] = requests.map((r) => {
    const convs = convByRequest.get(r.id) ?? [];
    const awarded = convs.find((c) => c.status === "awarded");
    const lastActiveAt =
      convs
        .map((c) => c.last_message_at ?? c.created_at)
        .concat([r.created_at])
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ??
      r.created_at;
    const daysLeft = r.deadline
      ? Math.ceil((new Date(r.deadline).getTime() - Date.now()) / 86400000)
      : null;
    return {
      id: r.id,
      client_name: r.client_name,
      client_city: r.client_city,
      project_type: r.project_type,
      budget: r.budget,
      description: r.description,
      status: r.status,
      features: (r.features ?? []).map(String),
      deadline: r.deadline,
      max_unlocks: r.max_unlocks,
      current_unlocks_count: r.current_unlocks_count,
      candidates: convs.length,
      pendingOffers: convs.reduce((acc, c) => acc + c.pendingOffers, 0),
      firstConvId: convs[0]?.id ?? null,
      awardedName: awarded?.otherName ?? null,
      awardedConvId: awarded?.id ?? null,
      archived: convs.some((c) => c.status === "archived"),
      convIdToArchive:
        [awarded?.id ?? null, ...convs.map((c) => c.id)].find(
          (id): id is string => Boolean(id) && id !== awarded?.id
        ) ??
        awarded?.id ??
        convs[0]?.id ??
        null,
      lastActiveAt,
      daysLeft,
      review: reviewMap.get(r.id) ?? null,
    };
  });

  return (
    <div className="bg-surface py-6 md:py-10">
      <div className="container-tl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight">
              Mes briefs
            </h1>
            <p className="mt-2 text-base text-muted-foreground">
              Tous les briefs que tu as publiés, avec l’état des candidatures.
            </p>
          </div>
          <Link
            href="/poster"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground outline-none transition-colors hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <Megaphone className="size-4" aria-hidden="true" />
            Publier un brief
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="mt-8 flex flex-col items-center rounded-2xl border border-hairline bg-card px-6 py-12 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-primary-soft">
              <Megaphone className="size-6 text-primary" aria-hidden="true" />
            </span>
            <p className="mt-4 text-base font-semibold tracking-tight">
              Aucun brief publié
            </p>
            <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Publie ton besoin en 2 minutes : les développeurs te répondent
              dans la messagerie interne, sans jamais voir tes coordonnées.
            </p>
            <Link
              href="/poster"
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground outline-none transition-colors hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <Megaphone className="size-4" aria-hidden="true" />
              Publier mon premier brief
            </Link>
          </div>
        ) : (
          <div className="mt-8">
            <ClientProjects items={items} />
          </div>
        )}
      </div>
    </div>
  );
}
