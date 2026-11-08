"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  Check,
  Loader2,
  Mic,
  Pencil,
  Send,
  Sparkles,
  Trash,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import { formatFCFA, formatDateTime, formatRelativeTime } from "@/lib/formatting";
import { missionErrorMessage } from "@/lib/mission-labels";
import { AudioMessage, formatDuration } from "@/components/chat/audio-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "cn";

const MAX_RECORD_SECONDS = 600;
const PRESENCE_TOUCH_INTERVAL_MS = 60_000;
const PRESENCE_POLL_INTERVAL_MS = 45_000;

export type ThreadMessage = {
  id: string;
  sender_id: string | null;
  content: string;
  message_type: "text" | "offer" | "system" | "audio";
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
  audio_path?: string | null;
  audio_duration_seconds?: number | null;
};

export type ThreadOffer = {
  id: string;
  developer_id: string | null;
  total_price_fcfa: number;
  deposit_fcfa: number | null;
  delivery_days: number;
  description: string | null;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
};

type Props = {
  conversationId: string;
  userId: string;
  isClient: boolean;
  otherName: string;
  conversationStatus: "active" | "awarded" | "archived";
  requestStatus: string;
  initialMessages: ThreadMessage[];
  initialOffers: ThreadOffer[];
  hasRequest?: boolean;
  missionId?: string | null;
};

export function MessageThread({
  conversationId,
  userId,
  isClient,
  otherName,
  conversationStatus,
  requestStatus,
  initialMessages,
  initialOffers,
  hasRequest = true,
  missionId = null,
}: Props) {
  const [messages, setMessages] = React.useState<ThreadMessage[]>(initialMessages);
  const [offers, setOffers] = React.useState<ThreadOffer[]>(initialOffers);
  const [draft, setDraft] = React.useState("");
  const [channelKey] = React.useState(() =>
    Math.random().toString(36).slice(2, 10)
  );
  const [sending, setSending] = React.useState(false);
  const [offerOpen, setOfferOpen] = React.useState(false);
  const [offerForm, setOfferForm] = React.useState({
    total: "",
    deposit: "",
    days: "",
    description: "",
  });
  const [offerSending, setOfferSending] = React.useState(false);
  const [creatingMission, setCreatingMission] = React.useState(false);
  const [peerId, setPeerId] = React.useState<string | null>(null);
  const [presence, setPresence] = React.useState<{
    online: boolean;
    lastSeenAt: string | null;
  } | null>(null);
  const [typingUsers, setTypingUsers] = React.useState<string[]>([]);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editDraft, setEditDraft] = React.useState("");
  const [savingEdit, setSavingEdit] = React.useState(false);
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [recording, setRecording] = React.useState(false);
  const [recordSeconds, setRecordSeconds] = React.useState(0);
  const [sendingVoice, setSendingVoice] = React.useState(false);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const recordSecondsRef = React.useRef(0);
  const recordTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const sendingVoiceRef = React.useRef(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const router = useRouter();

  const locked = conversationStatus !== "active";

  const quickReplies = isClient
    ? [
        "Merci pour votre proposition, je l'examine.",
        "Pouvons-nous échanger sur WhatsApp pour affiner le devis ?",
      ]
    : [
        "Bonjour, merci pour votre confiance. Je vous envoie une proposition chiffrée très rapidement.",
        "Je suis disponible pour un échange WhatsApp afin d'affiner votre besoin.",
      ];

  React.useEffect(() => {
    const supabase = createClient();
    void supabase.rpc("mark_entity_notifications_read", {
      p_entity_type: "conversation",
      p_entity_id: conversationId,
    });
  }, [conversationId]);

  React.useEffect(() => {
    const supabase = createClient();
    let active = true;
    void supabase
      .from("conversations")
      .select("developer_id, client_id")
      .eq("id", conversationId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        const peer =
          data.developer_id === userId ? data.client_id : data.developer_id;
        setPeerId(typeof peer === "string" && peer !== userId ? peer : null);
      });
    return () => {
      active = false;
    };
  }, [conversationId, userId]);

  React.useEffect(() => {
    const supabase = createClient();
    const touch = () => {
      void supabase.rpc("touch_presence");
    };
    touch();
    const timer = setInterval(touch, PRESENCE_TOUCH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    if (locked || !peerId) {
      setPresence(null);
      return;
    }
    const supabase = createClient();
    let active = true;
    const load = async () => {
      const { data, error } = await supabase.rpc("get_peer_presence", {
        p_peer_id: peerId,
      });
      if (!active) return;
      if (error || !data) {
        setPresence(null);
        return;
      }
      const payload = data as { online?: unknown; last_seen_at?: unknown };
      setPresence({
        online: payload.online === true,
        lastSeenAt:
          typeof payload.last_seen_at === "string" ? payload.last_seen_at : null,
      });
    };
    void load();
    const timer = setInterval(() => void load(), PRESENCE_POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [locked, peerId]);

  React.useEffect(() => {
    return () => {
      if (recordTimerRef.current !== null) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages.length]);

  const markRead = React.useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      const supabase = createClient();
      await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .in("id", ids);
      setMessages((prev) =>
        prev.map((m) => (ids.includes(m.id) && !m.read_at ? { ...m, read_at: new Date().toISOString() } : m))
      );
    },
    []
  );

  React.useEffect(() => {
    const unread = messages
      .filter(
        (m) =>
          m.sender_id !== userId &&
          !m.read_at &&
          (m.message_type === "text" || m.message_type === "audio")
      )
      .map((m) => m.id);
    if (unread.length > 0) void markRead(unread);
  }, [messages, userId, markRead]);

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`room:${conversationId}-${channelKey}`, {
      config: { presence: { key: userId } },
    });
    try {
      channel
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const row = payload.new as ThreadMessage;
            setMessages((prev) =>
              prev.some((m) => m.id === row.id) ? prev : [...prev, row]
            );
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const row = payload.new as ThreadMessage;
            setMessages((prev) => prev.map((m) => (m.id === row.id ? row : m)));
          }
        )
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState();
          const typing: string[] = [];
          for (const [key, presences] of Object.entries(state)) {
            if (key === userId) continue;
            for (const p of presences as { typing?: boolean }[]) {
              if (p.typing) typing.push(otherName);
            }
          }
          setTypingUsers(typing);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel.track({ typing: false, name: "" });
          }
        });
    } catch {
      // Realtime indisponible : les messages restent accessibles via le fetch initial.
    }

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, channelKey, userId, otherName]);

  const sendMessage = async () => {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: userId,
        content,
        message_type: "text",
      });
    setSending(false);
    if (error) {
      toast.error("Envoi impossible. Réessayez.");
      return;
    }
    setDraft("");
  };

  const startEdit = (msg: ThreadMessage) => {
    if (msg.message_type !== "text" || msg.deleted_at) return;
    setEditingId(msg.id);
    setEditDraft(msg.content);
  };

  const cancelEdit = () => {
    if (savingEdit) return;
    setEditingId(null);
    setEditDraft("");
  };

  const saveEdit = async () => {
    const targetId = editingId;
    if (!targetId || savingEdit) return;
    const content = editDraft.trim();
    if (!content) {
      toast.error("Le message ne peut pas être vide.");
      return;
    }
    setSavingEdit(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("edit_message", {
      p_message_id: targetId,
      p_content: content,
    });
    setSavingEdit(false);
    if (error) {
      toast.error(error.message || "Modification impossible. Réessayez.");
      return;
    }
    setMessages((prev) =>
      prev.map((m) =>
        m.id === targetId
          ? { ...m, content, edited_at: new Date().toISOString() }
          : m
      )
    );
    setEditingId(null);
    setEditDraft("");
  };

  const confirmDelete = async () => {
    const targetId = deleteTargetId;
    if (!targetId || deleting) return;
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("soft_delete_message", {
      p_message_id: targetId,
    });
    setDeleting(false);
    if (error) {
      toast.error(error.message || "Suppression impossible. Réessayez.");
      return;
    }
    setMessages((prev) =>
      prev.map((m) =>
        m.id === targetId
          ? {
              ...m,
              deleted_at: new Date().toISOString(),
              content: "",
              audio_path: null,
            }
          : m
      )
    );
    setDeleteTargetId(null);
  };

  const resetRecording = React.useCallback(() => {
    if (recordTimerRef.current !== null) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    recordSecondsRef.current = 0;
    setRecording(false);
    setRecordSeconds(0);
  }, []);

  const collectRecordingBlob = (
    recorder: MediaRecorder
  ): Promise<Blob | null> =>
    new Promise((resolve) => {
      const flush = () => {
        const type = (recorder.mimeType || "audio/webm").split(";")[0];
        const blob =
          chunksRef.current.length > 0
            ? new Blob(chunksRef.current, { type })
            : null;
        chunksRef.current = [];
        resolve(blob);
      };
      if (recorder.state === "inactive") {
        flush();
        return;
      }
      recorder.onstop = flush;
      recorder.stop();
    });

  const sendVoiceMessage = async () => {
    const recorder = recorderRef.current;
    if (!recorder || sendingVoiceRef.current) return;
    sendingVoiceRef.current = true;
    setSendingVoice(true);
    const duration = Math.min(
      Math.max(recordSecondsRef.current, 1),
      MAX_RECORD_SECONDS
    );
    const blob = await collectRecordingBlob(recorder);
    resetRecording();
    if (!blob || blob.size === 0) {
      sendingVoiceRef.current = false;
      setSendingVoice(false);
      toast.error("Enregistrement vide. Réessayez.");
      return;
    }
    const type = (blob.type || "audio/webm").split(";")[0];
    const extension = type.includes("mp4")
      ? "m4a"
      : type.includes("ogg")
        ? "ogg"
        : type.includes("wav")
          ? "wav"
          : type.includes("mpeg")
            ? "mp3"
            : "webm";
    const path = `${userId}/${conversationId}/${crypto.randomUUID()}.${extension}`;
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from("message-audio")
      .upload(path, blob, { contentType: type, upsert: false });
    if (uploadError) {
      sendingVoiceRef.current = false;
      setSendingVoice(false);
      toast.error("Envoi du message vocal impossible. Réessayez.");
      return;
    }
    const { data: sent, error } = await supabase.rpc("send_message", {
      p_conversation_id: conversationId,
      p_content: "",
      p_message_type: "audio",
      p_audio_path: path,
      p_audio_duration_seconds: duration,
    });
    sendingVoiceRef.current = false;
    setSendingVoice(false);
    if (error || !sent) {
      void supabase.storage.from("message-audio").remove([path]);
      toast.error("Message vocal non envoyé. Réessayez.");
      return;
    }
    const row = sent as {
      id?: string;
      sender_id?: string | null;
      created_at?: string;
    };
    const newId = typeof row?.id === "string" ? row.id : null;
    if (newId) {
      setMessages((prev) =>
        prev.some((m) => m.id === newId)
          ? prev
          : [
              ...prev,
              {
                id: newId,
                sender_id: row.sender_id ?? userId,
                content: "",
                message_type: "audio",
                metadata: null,
                read_at: null,
                created_at: row.created_at ?? new Date().toISOString(),
                edited_at: null,
                deleted_at: null,
                audio_path: path,
                audio_duration_seconds: duration,
              },
            ]
      );
    }
  };

  const cancelRecording = () => {
    const recorder = recorderRef.current;
    chunksRef.current = [];
    if (recorder) {
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
    }
    resetRecording();
  };

  const startRecording = async () => {
    if (recording || sendingVoice) return;
    if (
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      toast.error("Enregistrement audio non pris en charge par ce navigateur.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (
        name === "NotAllowedError" ||
        name === "PermissionDeniedError" ||
        name === "SecurityError"
      ) {
        toast.error(
          "Micro refusé : autorisez le microphone du navigateur pour envoyer un message vocal."
        );
      } else {
        toast.error("Micro indisponible. Vérifiez votre appareil audio.");
      }
      return;
    }
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      toast.error("Enregistrement audio non pris en charge par ce navigateur.");
      return;
    }
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorderRef.current = recorder;
    streamRef.current = stream;
    recordSecondsRef.current = 0;
    setRecordSeconds(0);
    setRecording(true);
    recorder.start();
    recordTimerRef.current = setInterval(() => {
      const next = recordSecondsRef.current + 1;
      recordSecondsRef.current = next;
      setRecordSeconds(next);
      if (next >= MAX_RECORD_SECONDS) {
        if (recordTimerRef.current !== null) {
          clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
        }
        void sendVoiceMessage();
      }
    }, 1000);
  };

  const sendOffer = async () => {
    const total = Number.parseInt(offerForm.total, 10);
    const days = Number.parseInt(offerForm.days, 10);
    if (Number.isNaN(total) || total < 1) {
      toast.error("Indiquez un montant valide.");
      return;
    }
    if (Number.isNaN(days) || days < 1) {
      toast.error("Indiquez un délai valide.");
      return;
    }
    setOfferSending(true);
    const supabase = createClient();
    const { data: offer, error } = await supabase
      .from("formal_offers")
      .insert({
        conversation_id: conversationId,
        developer_id: userId,
        total_price_fcfa: total,
        deposit_fcfa: offerForm.deposit ? Number.parseInt(offerForm.deposit, 10) || null : null,
        delivery_days: days,
        description: offerForm.description.trim() || null,
      })
      .select("id")
      .single();
    if (error || !offer) {
      setOfferSending(false);
      toast.error("Devis non envoyé. Réessayez.");
      return;
    }
    const { error: msgError } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: userId,
      content: "Proposition chiffrée envoyée.",
      message_type: "offer",
      metadata: {
        offer_id: offer.id,
        total_price_fcfa: total,
        deposit_fcfa: offerForm.deposit ? Number.parseInt(offerForm.deposit, 10) || 0 : 0,
        delivery_days: days,
      },
    });
    setOfferSending(false);
    if (msgError) {
      toast.error("Devis envoyé mais message non affiché. Actualisez la page.");
      return;
    }
    setOffers((prev) => [
      ...prev,
      {
        id: offer.id,
        developer_id: userId,
        total_price_fcfa: total,
        deposit_fcfa: offerForm.deposit ? Number.parseInt(offerForm.deposit, 10) || null : null,
        delivery_days: days,
        description: offerForm.description.trim() || null,
        status: "pending",
        created_at: new Date().toISOString(),
      },
    ]);
    setOfferOpen(false);
    setOfferForm({ total: "", deposit: "", days: "", description: "" });
    toast.success("Votre devis a été envoyé.");
  };

  const acceptOffer = async (offerId: string) => {
    const supabase = createClient();
    const { error } = await supabase.rpc("accept_formal_offer", {
      p_offer_id: offerId,
    });
    if (error) {
      toast.error(error.message || "Impossible d’accepter ce devis.");
      return;
    }
    setOffers((prev) => prev.map((o) => (o.id === offerId ? { ...o, status: "accepted" } : o)));
    toast.success("Devis accepté. Le projet démarre !");
    setTimeout(() => router.refresh(), 400);
  };

  const rejectOffer = async (offerId: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("formal_offers")
      .update({ status: "rejected" })
      .eq("id", offerId);
    if (error) {
      toast.error("Impossible de refuser ce devis.");
      return;
    }
    setOffers((prev) => prev.map((o) => (o.id === offerId ? { ...o, status: "rejected" } : o)));
  };

  const awardedOffer = offers.find((o) => o.status === "accepted");

  const startMission = async () => {
    if (!awardedOffer) return;
    setCreatingMission(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("create_mission_from_offer", {
      p_offer_id: awardedOffer.id,
    });
    setCreatingMission(false);
    if (error) {
      toast.error(missionErrorMessage(error.code ?? null, error.message || "Impossible de créer la mission."));
      return;
    }
    toast.success("Mission créée. C'est parti !");
    setTimeout(() => router.refresh(), 350);
  };

  return (
    <div className="flex h-full min-h-[60vh] flex-col overflow-hidden rounded-2xl border border-hairline bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4">
        <div className="min-w-0">
          <p className="truncate font-semibold tracking-tight">{otherName}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {locked ? "Discussion clôturée" : "Discussion en direct"}
          </p>
        </div>
        {locked ? (
          <span className="badge badge-warning">Projet attribué</span>
        ) : presence ? (
          presence.online ? (
            <span className="flex items-center gap-1.5 text-xs text-success">
              <span className="size-2 rounded-full bg-success" aria-hidden="true" />
              En ligne
            </span>
          ) : presence.lastSeenAt ? (
            <span className="text-xs text-muted-foreground">
              Vu {formatRelativeTime(presence.lastSeenAt)}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-success">
              <span className="size-2 rounded-full bg-success" aria-hidden="true" />
              Temps réel
            </span>
          )
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-success">
            <span className="size-2 rounded-full bg-success" aria-hidden="true" />
            Temps réel
          </span>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
        {messages.length === 0 && offers.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Commencez la conversation pour ce projet.
          </p>
        ) : null}

        {offers.map((offer) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            mine={offer.developer_id === userId}
            isClient={isClient}
            canAct={isClient && offer.status === "pending" && conversationStatus === "active"}
            onAccept={() => acceptOffer(offer.id)}
            onReject={() => rejectOffer(offer.id)}
          />
        ))}

        {messages.map((msg) => {
          if (msg.message_type === "offer") return null;
          if (msg.message_type === "system") {
            return (
              <div
                key={msg.id}
                className="flex justify-center"
              >
                <p className="max-w-sm rounded-full border border-hairline bg-muted px-4 py-1.5 text-center text-xs text-muted-foreground">
                  {msg.content}
                </p>
              </div>
            );
          }
          const mine = msg.sender_id === userId;
          const deleted = Boolean(msg.deleted_at);
          const isAudio = msg.message_type === "audio" && !deleted;
          const isEditing = editingId === msg.id;

          if (deleted) {
            return (
              <div key={msg.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div className="max-w-[78%] rounded-2xl border border-dashed border-hairline bg-transparent px-4 py-2.5 text-sm italic text-muted-foreground">
                  Message supprimé
                </div>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={cn(
                "group flex",
                mine ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
                  mine
                    ? "rounded-br-sm bg-primary text-ink"
                    : "rounded-bl-sm border border-hairline bg-muted"
                )}
              >
                {isEditing ? (
                  <div className="flex min-w-48 flex-col gap-2">
                    <Textarea
                      rows={2}
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void saveEdit();
                        }
                        if (e.key === "Escape") cancelEdit();
                      }}
                      className="min-h-10 resize-none rounded-xl bg-card text-foreground"
                      aria-label="Modifier le message"
                      autoFocus
                    />
                    <div className="flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        disabled={savingEdit}
                        onClick={cancelEdit}
                      >
                        Annuler
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={savingEdit || !editDraft.trim()}
                        onClick={() => void saveEdit()}
                      >
                        {savingEdit ? (
                          <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                        ) : null}
                        Enregistrer
                      </Button>
                    </div>
                  </div>
                ) : isAudio ? (
                  <AudioMessage
                    messageId={msg.id}
                    durationSeconds={msg.audio_duration_seconds ?? null}
                  />
                ) : (
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                )}
                <p
                  className={cn(
                    "mt-1 flex items-center justify-end gap-1.5 text-[10px]",
                    mine ? "text-ink/60" : "text-muted-foreground"
                  )}
                >
                  {msg.edited_at ? <span>(modifié)</span> : null}
                  <span>{formatDateTime(msg.created_at)}</span>
                  {mine && !isEditing ? (
                    <span className="inline-flex items-center gap-0.5">
                      <Check className="size-3" aria-hidden="true" />
                      {msg.read_at ? "Vu" : "Envoyé"}
                    </span>
                  ) : null}
                </p>
                {mine && !isEditing ? (
                  <div
                    className={cn(
                      "mt-1 flex justify-end gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100",
                      mine ? "text-ink/70" : "text-muted-foreground"
                    )}
                  >
                    {msg.message_type === "text" ? (
                      <button
                        type="button"
                        onClick={() => startEdit(msg)}
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] transition-colors outline-none hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-primary/50"
                        aria-label="Modifier"
                      >
                        <Pencil className="size-3" aria-hidden="true" />
                        Modifier
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setDeleteTargetId(msg.id)}
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] transition-colors outline-none hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-primary/50"
                      aria-label="Supprimer"
                    >
                      <Trash className="size-3" aria-hidden="true" />
                      Supprimer
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}

        <TypingIndicator names={typingUsers} />

        {awardedOffer ? (
          <div className="rounded-2xl border border-success/30 bg-success-soft p-4 text-sm text-success">
            <p className="font-semibold">Projet attribué</p>
            <p className="mt-1 text-xs">
              Le devis de {formatFCFA(awardedOffer.total_price_fcfa)} en{" "}
              {awardedOffer.delivery_days} jour{awardedOffer.delivery_days > 1 ? "s" : ""} a été
              accepté. La discussion est clôturée.
            </p>
            {isClient && !missionId ? (
              <button
                type="button"
                disabled={creatingMission}
                onClick={() => void startMission()}
                className="mt-3 inline-flex h-9 items-center gap-2 rounded-xl bg-success px-4 text-xs font-semibold text-white shadow-sm transition-opacity outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-success/50 disabled:opacity-60"
              >
                {creatingMission ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <ClipboardList className="size-3.5" aria-hidden="true" />
                )}
                {creatingMission ? "Création…" : "Démarrer la mission"}
              </button>
            ) : null}
            {missionId ? (
              <Link
                href={`/missions/${missionId}`}
                className="mt-3 inline-flex h-9 items-center gap-2 rounded-xl bg-success px-4 text-xs font-semibold text-white shadow-sm transition-opacity outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-success/50"
              >
                <ClipboardList className="size-3.5" aria-hidden="true" />
                Suivre la mission
              </Link>
            ) : null}
          </div>
        ) : null}

        <div ref={bottomRef} aria-hidden="true" />
      </div>

      <div className="border-t border-hairline px-5 py-4">
        {locked ? (
          <p className="text-center text-sm text-muted-foreground">
            {requestStatus === "attribué"
              ? "Ce projet a été attribué : échangez désormais par WhatsApp en direct."
              : "Cette conversation est archivée."}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {!isClient && hasRequest ? (
              <Button
                variant="secondary"
                size="sm"
                className="self-start border-primary/30 bg-primary-soft text-primary hover:bg-primary/20"
                onClick={() => setOfferOpen(true)}
              >
                <Sparkles className="size-3.5" aria-hidden="true" />
                Envoyer un devis formel
              </Button>
            ) : null}

            <div className="flex flex-wrap gap-1.5">
              {quickReplies.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setDraft(t)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-xs text-muted-foreground transition-colors outline-none hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <Zap className="size-3 text-primary" aria-hidden="true" />
                  <span className="line-clamp-1">{t}</span>
                </button>
              ))}
            </div>

            {recording ? (
              <div className="flex items-center gap-2 rounded-xl border border-hairline bg-surface px-3 py-2">
                <span className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                  <span className="size-2 animate-pulse rounded-full bg-destructive" aria-hidden="true" />
                  Enregistrement · {formatDuration(recordSeconds)}
                </span>
                <div className="ml-auto flex gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2.5 text-xs"
                    disabled={sendingVoice}
                    onClick={cancelRecording}
                  >
                    Annuler
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 px-2.5 text-xs"
                    disabled={sendingVoice}
                    onClick={() => void sendVoiceMessage()}
                  >
                    {sendingVoice ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Send className="size-3.5" aria-hidden="true" />
                    )}
                    Envoyer
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-end gap-2">
                <Button
                  variant="outline"
                  className="h-10 w-10 shrink-0 rounded-xl"
                  onClick={() => void startRecording()}
                  disabled={sendingVoice}
                  aria-label="Message vocal"
                >
                  <Mic className="size-4" aria-hidden="true" />
                </Button>
                <Textarea
                  rows={1}
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    // Broadcast typing status via presence.
                    const supabase = createClient();
                    const ch = supabase.channel(`room:${conversationId}-${channelKey}`, {
                      config: { presence: { key: userId } },
                    });
                    void ch.track({ typing: e.target.value.length > 0 });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  placeholder={`Écrire à ${otherName}…`}
                  className="max-h-32 min-h-10 flex-1 resize-none rounded-xl"
                  aria-label="Message"
                />
                <Button
                  onClick={sendMessage}
                  disabled={sending || !draft.trim()}
                  className="h-10 shrink-0"
                  aria-label="Envoyer"
                >
                  {sending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Send className="size-4" aria-hidden="true" />
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={offerOpen} onOpenChange={setOfferOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Devis formel</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="offer-total">Prix total (FCFA) *</Label>
              <Input
                id="offer-total"
                type="number"
                inputMode="numeric"
                min={1}
                value={offerForm.total}
                onChange={(e) => setOfferForm((f) => ({ ...f, total: e.target.value }))}
                placeholder="Ex. 250000"
                disabled={offerSending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="offer-deposit">Acompte (FCFA, optionnel)</Label>
              <Input
                id="offer-deposit"
                type="number"
                inputMode="numeric"
                min={0}
                value={offerForm.deposit}
                onChange={(e) => setOfferForm((f) => ({ ...f, deposit: e.target.value }))}
                placeholder="Ex. 50000"
                disabled={offerSending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="offer-days">Délai de livraison (jours) *</Label>
              <Input
                id="offer-days"
                type="number"
                inputMode="numeric"
                min={1}
                value={offerForm.days}
                onChange={(e) => setOfferForm((f) => ({ ...f, days: e.target.value }))}
                placeholder="Ex. 21"
                disabled={offerSending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="offer-desc">Description (optionnel)</Label>
              <Textarea
                id="offer-desc"
                rows={3}
                value={offerForm.description}
                onChange={(e) => setOfferForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Ce qui est inclus, étapes, garanties…"
                disabled={offerSending}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose
              disabled={offerSending}
              render={
                <Button variant="outline" type="button">
                  Annuler
                </Button>
              }
            />
            <Button onClick={sendOffer} disabled={offerSending} className="h-9">
              {offerSending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="size-4" aria-hidden="true" />
              )}
              Envoyer le devis
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTargetId)}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetId(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer le message</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Le message sera remplacé par « Message supprimé » pour les deux
            participants. Cette action est définitive.
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              disabled={deleting}
              onClick={() => setDeleteTargetId(null)}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Trash className="size-3.5" aria-hidden="true" />
              )}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OfferCard({
  offer,
  mine,
  isClient,
  canAct,
  onAccept,
  onReject,
}: {
  offer: ThreadOffer;
  mine: boolean;
  isClient: boolean;
  canAct: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 shadow-sm",
        offer.status === "accepted"
          ? "border-success/40 bg-success-soft"
          : offer.status === "rejected"
            ? "border-hairline bg-muted opacity-70"
            : "border-primary/30 bg-muted"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Sparkles className={cn("size-3.5", offer.status === "pending" && "text-primary")} aria-hidden="true" />
          Devis formel {mine ? "· vous" : isClient ? "· développeur" : ""}
        </span>
        {offer.status === "pending" ? (
          <span className="badge badge-warning">En attente</span>
        ) : offer.status === "accepted" ? (
          <span className="badge badge-success">Accepté</span>
        ) : (
          <span className="badge badge-muted">Refusé</span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Prix total</p>
          <p className="mt-0.5 font-semibold">{formatFCFA(offer.total_price_fcfa)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Acompte</p>
          <p className="mt-0.5 font-semibold">
            {offer.deposit_fcfa ? formatFCFA(offer.deposit_fcfa) : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Délai</p>
          <p className="mt-0.5 font-semibold">
            {offer.delivery_days} jour{offer.delivery_days > 1 ? "s" : ""}
          </p>
        </div>
      </div>
      {offer.description ? (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{offer.description}</p>
      ) : null}
      {canAct ? (
        <div className="mt-4 flex gap-2">
          <Button onClick={onAccept} size="sm" className="h-8">
            <Check className="size-3.5" aria-hidden="true" />
            Accepter et attribuer le projet
          </Button>
          <Button onClick={onReject} size="sm" variant="outline" className="h-8">
            Refuser
          </Button>
        </div>
      ) : null}
    </div>
  );
}