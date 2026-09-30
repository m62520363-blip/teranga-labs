import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Phone } from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
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
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  if (!supabase) notFound();

  const thread = await getConversationThread(supabase, user.id, id);
  if (!thread) notFound();

  const { conversation } = thread;
  const request = thread.request;

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
            <h1 className="mt-3 text-2xl font-semibold leading-tight tracking-tight">
              {thread.otherName}
              {thread.otherUsername ? ` · @${thread.otherUsername}` : ""}
            </h1>
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
          conversationStatus={conversation.status as "active" | "awarded" | "archived"}
          requestStatus={request?.status ?? ""}
          initialMessages={thread.messages as unknown as ThreadMessage[]}
          initialOffers={thread.offers as unknown as ThreadOffer[]}
          hasRequest={thread.hasRequest}
        />
      </div>
    </div>
  );
}