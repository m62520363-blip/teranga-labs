import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";
import { getConversationThread } from "@/lib/conversations";
import {
  MessageThread,
  type ThreadMessage,
  type ThreadOffer,
} from "@/components/chat/message-thread";

export const metadata: Metadata = {
  title: "Discussion",
  description: "Votre conversation privée autour d’un brief.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ConversationThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) notFound();

  const thread = await getConversationThread(supabase, user.id, id);
  if (!thread) notFound();

  const { conversation } = thread;
  const request = thread.request;

  const mission = await supabase
    .from("missions")
    .select("id")
    .eq("conversation_id", id)
    .maybeSingle();

  return (
    <div className="bg-surface py-8 md:py-12">
      <div className="container-tl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href="/conversations"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Toutes les discussions
            </Link>
            <div className="mt-3 flex items-center gap-3">
              {thread.otherAvatar ? (
                <Image
                  src={thread.otherAvatar}
                  alt=""
                  width={44}
                  height={44}
                  unoptimized
                  className="size-11 shrink-0 rounded-full border border-hairline object-cover"
                />
              ) : null}
              <h1 className="text-2xl font-semibold leading-tight tracking-tight">
                {thread.otherUsername ? (
                  <Link
                    href={`/dev/${encodeURIComponent(thread.otherUsername)}`}
                    className="transition-colors hover:text-primary"
                  >
                    {thread.otherName}
                  </Link>
                ) : (
                  thread.otherName
                )}
                {thread.otherUsername ? (
                  <span className="text-muted-foreground">{` · @${thread.otherUsername}`}</span>
                ) : null}
              </h1>
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">{thread.subtitle}</p>
          </div>

          {conversation.status === "awarded" ? (
            <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success-soft px-4 py-2.5 text-sm text-success">
              <Phone className="size-4" aria-hidden="true" />
              Contact partagé : échangez en direct hors plateforme
            </div>
          ) : null}
        </div>

        <MessageThread
          conversationId={id}
          userId={user.id}
          isClient={thread.isClient}
          otherName={thread.otherName}
          otherAvatar={thread.otherAvatar}
          conversationStatus={conversation.status as "active" | "awarded" | "archived"}
          requestStatus={request?.status ?? ""}
          initialMessages={thread.messages as unknown as ThreadMessage[]}
          initialOffers={thread.offers as unknown as ThreadOffer[]}
          hasRequest={thread.hasRequest}
          missionId={mission?.data?.id ?? null}
        />
      </div>
    </div>
  );
}