import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Check,
  ClipboardPen,
  Coins,
  FileSearch,
  Inbox,
  MessageCircle,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { getConversations } from "@/lib/conversations";
import { formatFCFA, formatRelativeTime } from "@/lib/formatting";
import type { TokenHistoryItem } from "@/types/database";
import { EmptyState } from "@/components/empty-state";
import {
  ClientProjects,
  type ClientProjectItem,
} from "@/components/client-projects";
import { cn } from "cn";

export const metadata: Metadata = {
  title: "Mon espace client",
  description:
    "Vos briefs publiés, les devis reçus, vos discussions et le suivi de vos missions.",
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

export default async function ClientPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  if (!supabase) {
    return (
      <div className="bg-[#0F0F0F] py-16">
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

  const [requestsRes, conversations, tokenBalanceRes, tokenHistoryRes, reviewMapRes] =
    await Promise.all([
      supabase.rpc("get_my_requests" as never),
      getConversations(supabase, user.id),
      supabase.rpc("get_token_balance"),
      supabase.rpc("get_my_token_history", { p_limit: 5 }),
      supabase.rpc("get_my_request_reviews"),
    ]);

  const tokenBalance = typeof tokenBalanceRes.data === "number" ? tokenBalanceRes.data : 0;
  const tokenHistory = ((tokenHistoryRes.data ?? []) as TokenHistoryItem[]).filter(
    (t) => Boolean(t?.id)
  );

  const requests = (
    (requestsRes.data ?? []) as MyRequest[]
  ).filter((r) => Boolean(r.id));

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

  const totalUnread = conversations.reduce((acc, c) => acc + c.unreadCount, 0);
  const totalPendingOffers = conversations.reduce(
    (acc, c) => acc + c.pendingOffers,
    0
  );
  const uniqueDevs = new Set(
    conversations.map(
      (c) => `${c.otherName}${c.otherUsername ? `@${c.otherUsername}` : c.id}`
    )
  ).size;
  const devisToReview = conversations.filter((c) => c.pendingOffers > 0);
  const missionsAwarded = conversations.filter((c) => c.status === "awarded");

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const company = String(meta.company_name ?? "").trim();
  const clientName = String(meta.full_name ?? "").trim();
  const city = String(meta.city ?? "").trim();
  const whatsapp = String(meta.whatsapp ?? "").trim();

  const projectItems: ClientProjectItem[] = requests.map((r) => {
    const convs = convByRequest.get(r.id) ?? [];
    const awarded = convs.find((c) => c.status === "awarded");
    const lastActiveAt =
      convs
        .map((c) => c.last_message_at ?? c.created_at)
        .concat([r.created_at])
        .sort(
          (a, b) => new Date(b).getTime() - new Date(a).getTime()
        )[0] ?? r.created_at;
    const daysLeft = r.deadline
      ? Math.ceil(
          (new Date(r.deadline).getTime() - Date.now()) / 86400000
        )
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
      convIdToArchive: [awarded?.id ?? null, ...convs.map((c) => c.id)].find(
        (id): id is string => Boolean(id) && id !== awarded?.id
      ) ?? awarded?.id ?? convs[0]?.id ?? null,
      lastActiveAt,
      daysLeft,
      review: reviewMap.get(r.id) ?? null,
    };
  });

  return (
    <div className="bg-[#0F0F0F] py-16 md:py-24">
      <div className="container-tl">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Mon espace client
            </h1>
            <p className="mt-2 text-base text-muted-foreground">
              Suivez vos projets, comparez les développeurs et acceptez une
              proposition en quelques clics.
            </p>
          </div>
          <Link
            href="/poster"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#E86A2C] px-5 text-sm font-medium text-[#0D0D0D] transition-colors outline-none hover:bg-[#d95c1f] focus-visible:ring-2 focus-visible:ring-[#E86A2C]/50"
          >
            <Plus className="size-4" aria-hidden="true" />
            Publier un nouveau brief
          </Link>
        </div>

        {(company || clientName) && (
          <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-[#2A2A2A] bg-[#141414] p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#E86A2C] font-display text-lg font-bold text-[#0D0D0D]">
              {(company || clientName).charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {(company && clientName) ? clientName : company || clientName}
                {company ? <span className="text-muted-foreground"> · {company}</span> : null}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {[city, whatsapp].filter(Boolean).join(" · ") || "Profil client"}
              </p>
            </div>
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[#166534]/60 bg-[#0F2E18] px-3 py-1 text-xs font-medium text-[#4ADE80]">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              WhatsApp masqué pour les développeurs
            </span>
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<ClipboardPen className="size-4" aria-hidden="true" />}
            value={requests.length}
            label="Projets publiés"
          />
          <StatCard
            icon={<Inbox className="size-4" aria-hidden="true" />}
            value={uniqueDevs}
            label="Développeurs en contact"
          />
          <StatCard
            icon={<FileSearch className="size-4" aria-hidden="true" />}
            value={totalPendingOffers}
            label="Devis à examiner"
            accent={totalPendingOffers > 0}
          />
          <StatCard
            icon={<MessageCircle className="size-4" aria-hidden="true" />}
            value={totalUnread}
            label="Messages non lus"
            accent={totalUnread > 0}
          />
        </div>

        {missionsAwarded.length > 0 ? (
          <div className="mt-8 flex items-start gap-3 rounded-2xl border border-[#166534]/60 bg-[#0F2E18] p-4 sm:p-5">
            <Check className="mt-0.5 size-5 shrink-0 text-[#4ADE80]" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight">
                Vous avez une mission en cours
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {missionsAwarded
                  .map((c) => c.otherName)
                  .filter(Boolean)
                  .join(" et ")}{" "}
                travaille sur votre projet. Suivez l’avancement dans la
                discussion.
              </p>
            </div>
          </div>
        ) : null}

        <section className="mt-8 rounded-2xl border border-[#2A2A2A] bg-[#141414] p-5 sm:p-6" aria-label="Mes Tokens">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#2A1A10] text-[#E86A2C]">
                <Coins className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm text-muted-foreground">Mes Tokens</p>
                <p className="text-2xl font-semibold tracking-tight">
                  {tokenBalance}{" "}
                  <span className="text-sm font-medium text-muted-foreground">
                    Token{tokenBalance > 1 ? "s" : ""}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  1 brief publie / 1 contact direct = 1 Token.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/tokens"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[#2A2A2A] px-5 text-sm font-medium transition-colors outline-none hover:border-[#E86A2C]/40 hover:text-[#F2F2F2] focus-visible:ring-2 focus-visible:ring-[#E86A2C]/50"
              >
                Recharger
              </Link>
              <Link
                href="/dev"
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[#E86A2C] px-5 text-sm font-medium text-[#0D0D0D] transition-colors outline-none hover:bg-[#d95c1f] focus-visible:ring-2 focus-visible:ring-[#E86A2C]/50"
              >
                Trouver un développeur
              </Link>
            </div>
          </div>

          {tokenHistory.length > 0 ? (
            <ul className="mt-5 flex flex-col">
              {tokenHistory.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 border-t border-[#2A2A2A] py-2.5 first:border-t-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">{t.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeTime(t.created_at)} · solde {t.balance_before} →{" "}
                      {t.balance_after} Token
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-semibold",
                      (t.amount ?? 0) > 0 ? "text-[#4ADE80]" : "text-[#F87171]"
                    )}
                  >
                    {(t.amount ?? 0) > 0 ? "+" : ""}
                    {t.amount}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 border-t border-[#2A2A2A] pt-4 text-sm text-muted-foreground">
              Aucun mouvement pour le moment.
            </p>
          )}
        </section>

        <section className="mt-10">
          <div className="flex items-center gap-2">
            <ClipboardPen className="size-5 text-[#E86A2C]" aria-hidden="true" />
            <h2 className="text-xl font-semibold tracking-tight">Mes projets publiés</h2>
          </div>

          {requests.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                title="Vous n’avez pas encore publié de brief"
                description="Publier un projet coûte 1 Token : les développeurs vous contactent dans la messagerie interne, sans jamais voir votre WhatsApp tant que vous n’acceptez pas."
                action={
                  <Link href="/poster" className="btn btn-primary">
                    <Plus className="size-4" aria-hidden="true" />
                    Publier mon premier brief
                  </Link>
                }
              />
            </div>
          ) : (
            <ClientProjects items={projectItems} />
          )}
        </section>

        <section className="mt-14">
          <div className="flex items-center gap-2">
            <MessageCircle className="size-5 text-[#E86A2C]" aria-hidden="true" />
            <h2 className="text-xl font-semibold tracking-tight">Discussions reçues</h2>
          </div>

          {conversations.length === 0 ? (
            <p className="mt-5 text-sm text-muted-foreground">
              Quand un développeur débloque votre brief, il vous écrit ici —
              vous recevez sa proposition sans partager votre WhatsApp.
            </p>
          ) : (
            <ul className="mt-5 flex flex-col gap-3">
              {conversations.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/conversations/${c.id}`}
                    className={cn(
                      "flex items-center gap-4 rounded-2xl border p-4 transition-colors outline-none hover:bg-[#161616] focus-visible:ring-2 focus-visible:ring-[#E86A2C]/50 sm:p-5",
                      c.unreadCount > 0
                        ? "border-[#E86A2C]/30 bg-[#1A120B]"
                        : c.status === "awarded"
                          ? "border-[#166534]/60 bg-[#0F2E18]"
                          : "border-[#2A2A2A] bg-[#141414]"
                    )}
                  >
                    <div
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center rounded-xl",
                        c.unreadCount > 0
                          ? "bg-[#E86A2C] text-[#0D0D0D]"
                          : c.status === "awarded"
                            ? "bg-[#4ADE80] text-[#0D0D0D]"
                            : "bg-[#2A2A2A] text-[#F2F2F2]"
                      )}
                      aria-hidden="true"
                    >
                      {c.status === "awarded" ? (
                        <Check className="size-5" />
                      ) : (
                        <MessageCircle className="size-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-1">
                        <p className="truncate text-sm font-semibold">
                          {c.otherName}
                          {c.otherUsername ? ` · @${c.otherUsername}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {c.request.project_type} · {formatFCFA(c.request.budget)}
                        </p>
                      </div>
                      {c.pendingOffers > 0 ? (
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="badge badge-warning">
                            Devis {c.pendingOffers > 1 ? `${c.pendingOffers} devis ` : ""}à examiner
                          </span>
                        </div>
                      ) : c.status === "awarded" ? (
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="badge badge-success">Mission en cours</span>
                        </div>
                      ) : null}
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {c.lastMessage
                          ? (c.lastMessage.sender_id === user.id ? "Vous : " : "") +
                            (c.lastMessage.content.length > 50
                              ? c.lastMessage.content.slice(0, 50) + "…"
                              : c.lastMessage.content)
                          : "Le développeur n’a pas encore écrit."}
                      </p>
                    </div>
                    {c.unreadCount > 0 ? (
                      <span className="ml-2 flex size-6 shrink-0 items-center justify-center rounded-full bg-[#E86A2C] text-xs font-bold text-[#0D0D0D]">
                        {c.unreadCount}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {devisToReview.length > 0 ? (
          <section className="mt-14">
            <div className="flex items-center gap-2">
              <FileSearch className="size-5 text-[#E86A2C]" aria-hidden="true" />
              <h2 className="text-xl font-semibold tracking-tight">Devis à examiner</h2>
              <span className="rounded-full bg-[#2A2A2A] px-2 py-0.5 text-xs text-muted-foreground">
                {totalPendingOffers}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Comparez les propositions chiffrées et acceptez celle qui vous
              convient — vous décidez à qui vous confiez le projet.
            </p>
            <ul className="mt-5 flex flex-col gap-3">
              {devisToReview.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-col gap-3 rounded-2xl border border-[#E86A2C]/30 bg-[#1A120B] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{c.otherName}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {c.request.project_type} · {formatFCFA(c.request.budget)}
                    </p>
                    <span className="mt-1.5 inline-block">
                      <span className="badge badge-warning">
                        {c.pendingOffers} devis {c.pendingOffers > 1 ? "déposés" : "déposé"}
                      </span>
                    </span>
                  </div>
                  <Link
                    href={`/conversations/${c.id}`}
                    className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl bg-[#F2F2F2] px-4 text-sm font-medium text-[#0D0D0D] transition-colors outline-none hover:bg-[#EBEBEB] focus-visible:ring-2 focus-visible:ring-[#E86A2C]/50"
                  >
                    Examiner les devis
                    <FileSearch className="size-4" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
  accent,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[#2A2A2A] bg-[#141414] p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-lg",
            accent ? "bg-[#E86A2C] text-[#0D0D0D]" : "bg-[#2A2A2A] text-[#F2F2F2]"
          )}
        >
          {icon}
        </span>
        {label}
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}