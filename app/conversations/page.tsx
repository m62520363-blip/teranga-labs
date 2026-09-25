import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { getConversations } from "@/lib/conversations";
import { ConversationsList } from "@/components/conversations-list";

export const metadata: Metadata = {
  title: "Mes discussions",
  description: "Vos conversations privées autour des briefs Teranga Labs.",
};

export const dynamic = "force-dynamic";

export default async function ConversationsPage() {
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

  const conversations = await getConversations(supabase, user.id);
  const totalUnread = conversations.reduce((acc, c) => acc + c.unreadCount, 0);

  return (
    <div className="bg-[#0F0F0F] py-16 md:py-24">
      <div className="container-tl">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Mes discussions
            </h1>
            <p className="mt-2 text-base text-muted-foreground">
              Vos échanges privés autour des briefs, en temps réel.
            </p>
          </div>
          {totalUnread > 0 ? (
            <span className="badge badge-warning">
              {totalUnread} message{totalUnread > 1 ? "s" : ""} non lu{totalUnread > 1 ? "s" : ""}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-[#3DD68C]">
              <Check className="size-4" aria-hidden="true" />
              Tout est lu
            </span>
          )}
        </div>

        <div className="mt-10">
          <ConversationsList
            conversations={conversations}
            userId={user.id}
          />
        </div>
      </div>
    </div>
  );
}