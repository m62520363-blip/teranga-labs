import type { SupabaseClient } from "@supabase/supabase-js";

export type ConversationListItem = {
  id: string;
  status: "active" | "awarded" | "archived";
  last_message_at: string | null;
  created_at: string;
  request: {
    id: string;
    client_name: string;
    client_city: string;
    project_type: string;
    budget: number;
    status: string;
  };
  otherName: string;
  otherUsername: string | null;
  otherAvatar: string | null;
  subtitle: string;
  lastMessage: {
    content: string;
    sender_id: string | null;
    read_at: string | null;
    created_at: string;
    message_type?: string | null;
    deleted_at?: string | null;
  } | null;
  unreadCount: number;
  pendingOffers: number;
};

type PublicDevProfile = {
  full_name?: string | null;
  username?: string | null;
  city?: string | null;
  avatar_url?: string | null;
};

type PublicRequestRow = {
  id: string;
  client_name: string;
  client_city: string;
  project_type: string;
  budget: number;
  status: string;
};

type ConversationRow = {
  id: string;
  request_id: string | null;
  developer_id: string | null;
  client_id: string | null;
  status: string;
  last_message_at: string | null;
  created_at: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  content: string;
  read_at: string | null;
  created_at: string;
  message_type?: string | null;
  deleted_at?: string | null;
};

const PUBLIC_REQUEST_COLS = [
  "id",
  "client_name",
  "client_city",
  "project_type",
  "budget",
  "status",
] as const;

export async function getConversations(
  supabase: SupabaseClient,
  userId: string
): Promise<ConversationListItem[]> {
  const { data } = await supabase
    .from("conversations")
    .select("id, request_id, developer_id, client_id, status, last_message_at, created_at")
    .or(`developer_id.eq.${userId},client_id.eq.${userId}`)
    .order("last_message_at", { ascending: false });

  const rows = (data ?? []) as ConversationRow[];
  if (rows.length === 0) return [];

  const requestIds = [...new Set(rows.map((r) => r.request_id).filter(Boolean))] as string[];
  const { data: reqs } = await supabase
    .from("requests")
    .select(PUBLIC_REQUEST_COLS.join(", "))
    .in("id", requestIds);
  const requests = new Map(
    ((reqs ?? []) as unknown as PublicRequestRow[]).map((r) => [r.id, r])
  );

  const { data: msgs } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, content, read_at, created_at, message_type, deleted_at")
    .in("conversation_id", rows.map((r) => r.id))
    .order("created_at", { ascending: false });

  const byConversation = new Map<string, MessageRow[]>();
  for (const m of (msgs ?? []) as unknown as MessageRow[]) {
    const arr = byConversation.get(m.conversation_id) ?? [];
    arr.push(m);
    byConversation.set(m.conversation_id, arr);
  }

  const { data: offerRows } = await supabase
    .from("formal_offers")
    .select("id, conversation_id")
    .in("conversation_id", rows.map((r) => r.id))
    .eq("status", "pending");
  const pendingByConversation = new Map<string, number>();
  for (const o of (offerRows ?? []) as unknown as { conversation_id: string }[]) {
    pendingByConversation.set(o.conversation_id, (pendingByConversation.get(o.conversation_id) ?? 0) + 1);
  }

  const names = new Map<string, { name: string; username: string | null; avatar: string | null }>();
  const peerCache = new Map<string, PeerDisplay | null>();
  for (const c of rows) {
    if (c.developer_id === userId || c.client_id === userId) continue;
    const req = c.request_id ? requests.get(c.request_id) : undefined;
    if (c.developer_id && c.developer_id !== userId && req) {
      const reqName = req.client_name ?? "Client";
      await fetchDevName(supabase, c.developer_id, reqName, names);
    }
  }

  for (const c of rows) {
    if (c.request_id !== null) continue;
    const peerId =
      c.developer_id === userId ? c.client_id : c.client_id === userId ? c.developer_id : null;
    if (!peerId) continue;
    if (!peerCache.has(peerId)) {
      const peer = await fetchPeerDisplay(supabase, peerId);
      peerCache.set(peerId, peer);
    }
  }

  return rows
    .map((c) => {
      const req = c.request_id ? requests.get(c.request_id) : undefined;
      const isDev = c.developer_id === userId;
      const isClient = c.client_id === userId;

      let otherName = "Client";
      let otherUsername: string | null = null;
      let otherAvatar: string | null = null;
      let subtitle = "Projet";
      if (isDev && req) {
        otherName = req.client_name ?? "Client";
        subtitle = `${req.client_city || "Projet"} · ${req.project_type} · ${formatBudget(req.budget)}`;
      } else if (isDev && !req) {
        otherName = "Client";
        const peer = peerCache.get(c.client_id ?? "") ?? null;
        if (peer) {
          otherName = peer.name || "Client";
          otherUsername = peer.username ?? null;
          otherAvatar = peer.avatar ?? null;
          subtitle = peer.subtitle || "Contact direct";
        } else {
          subtitle = "Contact direct";
        }
      } else if (isClient && c.developer_id) {
        const entry = names.get(c.developer_id);
        const peer = peerCache.get(c.developer_id) ?? null;
        otherAvatar = entry?.avatar ?? peer?.avatar ?? null;
        if (entry) {
          otherName = entry.name;
          otherUsername = entry.username;
        } else {
          otherName = "Développeur";
        }
        if (peer) {
          otherName = peer.name || otherName;
          otherUsername = peer.username ?? otherUsername;
          subtitle = peer.subtitle || "Contact direct";
        } else if (req) {
          subtitle = `${req.client_city || "Projet"} · ${req.project_type} · ${formatBudget(req.budget)}`;
        } else {
          subtitle = "Contact direct";
        }
      }

      const threadMsgs = (byConversation.get(c.id) ?? []).sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      let unreadCount = 0;
      for (const m of threadMsgs) {
        if (m.sender_id !== userId && !m.read_at) unreadCount += 1;
      }

      return {
        id: c.id,
        status: c.status as "active" | "awarded" | "archived",
        last_message_at: c.last_message_at,
        created_at: c.created_at,
        request: {
          id: c.request_id ?? "",
          client_name: req?.client_name ?? "Projet",
          client_city: req?.client_city ?? "",
          project_type: req?.project_type ?? "",
          budget: req?.budget ?? 0,
          status: req?.status ?? "",
        },
        otherName,
        otherUsername,
        otherAvatar,
        subtitle,
        lastMessage: threadMsgs.length > 0 ? threadMsgs[threadMsgs.length - 1] : null,
        unreadCount,
        pendingOffers: pendingByConversation.get(c.id) ?? 0,
      };
    })
    .sort(
      (a, b) =>
        (b.last_message_at ? new Date(b.last_message_at).getTime() : 0) -
        (a.last_message_at ? new Date(a.last_message_at).getTime() : 0)
    );
}

async function fetchDevName(
  supabase: SupabaseClient,
  developerId: string,
  fallback: string,
  cache: Map<string, { name: string; username: string | null; avatar: string | null }>
) {
  if (cache.has(developerId)) return;
  const { data } = await supabase.rpc("get_public_developer_profile", {
    p_identifier: developerId,
  });
  const profile = (data ?? null) as PublicDevProfile | null;
  const name =
    profile?.full_name || profile?.username || fallback;
  cache.set(developerId, {
    name,
    username: profile?.username ?? null,
    avatar: profile?.avatar_url ?? null,
  });
}

type PeerDisplay = {
  name: string;
  username: string | null;
  avatar: string | null;
  subtitle: string;
};

async function fetchPeerDisplay(
  supabase: SupabaseClient,
  peerId: string
): Promise<PeerDisplay | null> {
  const { data } = await supabase.rpc("get_peer_display_name", {
    p_user_id: peerId,
  });
  const peer = (data ?? null) as {
    full_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
    professional_title?: string | null;
    main_specialty?: string | null;
    company_name?: string | null;
    city?: string | null;
  } | null;
  if (!peer) return null;
  const identity = peer.company_name || peer.full_name || peer.username;
  const specialty = peer.professional_title || peer.main_specialty || "Contact direct";
  return {
    name: identity ?? "Interlocuteur",
    username: peer.username ?? null,
    avatar: peer.avatar_url ?? null,
    subtitle: peer.city ? `${specialty} · ${peer.city}` : specialty,
  };
}

const fcfaFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
});

function formatBudget(amount: number): string {
  return `${fcfaFormatter.format(amount)} FCFA`;
}

export async function getConversationThread(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string
) {
  const { data: conv } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conv) return null;
  const isParticipant =
    conv.developer_id === userId || conv.client_id === userId;
  if (!isParticipant) return null;

  const { data: req } = await supabase
    .from("requests")
    .select(PUBLIC_REQUEST_COLS.join(", "))
    .eq("id", conv.request_id ?? "")
    .maybeSingle();

  const request = (req ?? null) as PublicRequestRow | null;

  const isDev = conv.developer_id === userId;
  let otherName = request?.client_name ?? "Client";
  let otherUsername: string | null = null;
  let otherAvatar: string | null = null;
  let subtitle = "Projet";

  if (!isDev && conv.developer_id) {
    const profile = await fetchDevProfile(supabase, conv.developer_id);
    if (profile) {
      otherName = profile.full_name || profile.username || "Développeur";
      otherUsername = profile.username ?? null;
      otherAvatar = profile.avatar_url ?? null;
      subtitle = request
        ? `${request.client_city || "Projet"} · ${request.project_type} · ${formatBudget(request.budget)}`
        : "Contact direct";
    }
  } else if (request) {
    subtitle = `${request.client_city || "Projet"} · ${request.project_type} · ${formatBudget(request.budget)}`;
  } else if (isDev && conv.client_id) {
    const peer = await fetchPeerDisplay(supabase, conv.client_id);
    if (peer) {
      otherName = peer.name || "Client";
      otherUsername = peer.username ?? null;
      subtitle = peer.subtitle;
    } else {
      subtitle = "Contact direct";
    }
  }

  const { data: messages } = await supabase
    .from("messages")
    .select(
      "id, sender_id, content, message_type, metadata, read_at, created_at, edited_at, deleted_at, audio_path, audio_duration_seconds"
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  const { data: offers } = await supabase
    .from("formal_offers")
    .select("id, developer_id, total_price_fcfa, deposit_fcfa, delivery_days, description, status, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false });

  return {
    conversation: conv,
    request,
    otherName,
    otherUsername,
    otherAvatar,
    subtitle,
    hasRequest: conv.request_id != null,
    isClient: !isDev,
    messages: (messages ?? []) as never[],
    offers: (offers ?? []) as never[],
  };
}

async function fetchDevProfile(
  supabase: SupabaseClient,
  developerId: string
): Promise<PublicDevProfile | null> {
  const { data } = await supabase.rpc("get_public_developer_profile", {
    p_identifier: developerId,
  });
  return (data ?? null) as PublicDevProfile | null;
}