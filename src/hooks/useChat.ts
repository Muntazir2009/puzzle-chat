"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  pusherClient,
  getChannelName,
} from "@/lib/pusher-client";
import { getRoomId } from "@/lib/room";
import type { ChatChannelEvents } from "@/lib/pusher-server";
import type { Channel } from "pusher-js";
import { useHeartbeat } from "@/hooks/useHeartbeat";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  reply_to_id: string | null;
  reply_to_content: string | null;
  reply_to_sender_name: string | null;
  content: string;
  type: "text" | "image" | "file" | "voice";
  status: "sending" | "sent" | "delivered" | "read" | "failed";
  vanish_mode: boolean;
  ephemeral_seconds: number | null;
  voice_duration: number | null;
  waveform_data: number[] | null;
  reactions: Record<string, string[]>;
  created_at: string;
}

export interface SendMessageOptions {
  type?: "text" | "image" | "file" | "voice";
  vanish_mode?: boolean;
  ephemeral_seconds?: number | null;
  reply_to_id?: string | null;
  voice_duration?: number | null;
  waveform_data?: number[] | null;
}

export interface PartnerStatus {
  online: boolean;
  last_seen: string | null;
}

export interface UseChatOptions {
  currentUserId: string;
  otherUserId: string;
  conversationId: string;
  initialMessages?: ChatMessage[];
}

export interface UseChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  isPartnerTyping: boolean;
  partnerStatus: PartnerStatus;
  sendMessage: (content: string, opts?: SendMessageOptions) => Promise<void>;
  onTyping: () => void;
  markAsRead: (messageIds: string[]) => Promise<void>;
  vanishMessage: (messageId: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  sendReaction: (messageId: string, emoji: string, add: boolean) => void;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  loadingMore: boolean;
}

const TYPING_DEBOUNCE_MS = 2_000;

/** Normalize a raw message row from Supabase into a safe ChatMessage. */
function normalizeMessage(raw: Record<string, unknown>): ChatMessage {
  return {
    id: (raw.id as string) ?? "",
    conversation_id: (raw.conversation_id as string) ?? "",
    sender_id: (raw.sender_id as string) ?? "",
    sender_name: (raw.sender_name as string) ?? "",
    reply_to_id: (raw.reply_to_id as string) ?? null,
    reply_to_content: (raw.reply_to_content as string) ?? null,
    reply_to_sender_name: (raw.reply_to_sender_name as string) ?? null,
    content: (raw.content as string) ?? "",
    type: (raw.type as ChatMessage["type"]) ?? "text",
    status: (raw.status as ChatMessage["status"]) ?? "sent",
    vanish_mode: Boolean(raw.vanish_mode),
    ephemeral_seconds: (raw.ephemeral_seconds as number) ?? null,
    voice_duration: (raw.voice_duration as number) ?? null,
    waveform_data: Array.isArray(raw.waveform_data) ? raw.waveform_data as number[] : null,
    reactions: (raw.reactions && typeof raw.reactions === "object" ? raw.reactions : {}) as Record<string, string[]>,
    created_at: (raw.created_at as string) ?? new Date().toISOString(),
  };
}

export function useChat({
  currentUserId,
  otherUserId,
  conversationId,
  initialMessages = [],
}: UseChatOptions): UseChatReturn {
  const roomId = getRoomId(currentUserId, otherUserId);
  const channelName = getChannelName(roomId);
  const presenceChannelName = `presence-${roomId}`;

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(initialMessages.length === 0);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [partnerStatus, setPartnerStatus] = useState<PartnerStatus>({
    online: false,
    last_seen: null,
  });
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const nextCursorRef = useRef<string | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<Channel | undefined>(undefined);

  /* ---- Heartbeat (keeps last_seen up-to-date) -------------------- */
  useHeartbeat();

  /* ---- Fetch initial partner status ------------------------------ */
  useEffect(() => {
    let cancelled = false;
    async function fetchStatus() {
      try {
        const res = await fetch("/api/users/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_ids: [otherUserId] }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data[otherUserId]) {
          setPartnerStatus({
            online: data[otherUserId].online,
            last_seen: data[otherUserId].last_seen || null,
          });
        }
      } catch {
        /* silent */
      }
    }
    fetchStatus();
    return () => { cancelled = true; };
  }, [otherUserId]);

  /* ---- Presence channel for real-time online status --------------- */
  useEffect(() => {
    const presenceChannel = pusherClient.subscribe(presenceChannelName);

    function onSubscriptionSucceeded(members: { count: number; each: (cb: (member: { id: string }) => void) => void }) {
      let partnerOnline = false;
      members.each((member: { id: string }) => {
        if (member.id === otherUserId) partnerOnline = true;
      });
      setPartnerStatus((prev) => ({ ...prev, online: partnerOnline }));
    }

    function onMemberAdded(member: { id: string }) {
      if (member.id === otherUserId) {
        setPartnerStatus((prev) => ({ ...prev, online: true }));
      }
    }

    function onMemberRemoved(member: { id: string }) {
      if (member.id === otherUserId) {
        setPartnerStatus((prev) => ({ ...prev, online: false, last_seen: new Date().toISOString() }));
      }
    }

    presenceChannel.bind("pusher:subscription_succeeded", onSubscriptionSucceeded);
    presenceChannel.bind("pusher:member_added", onMemberAdded);
    presenceChannel.bind("pusher:member_removed", onMemberRemoved);

    return () => {
      presenceChannel.unbind("pusher:subscription_succeeded", onSubscriptionSucceeded);
      presenceChannel.unbind("pusher:member_added", onMemberAdded);
      presenceChannel.unbind("pusher:member_removed", onMemberRemoved);
      pusherClient.unsubscribe(presenceChannelName);
    };
  }, [presenceChannelName, otherUserId]);

  /* ---- Load history --------------------------------------------- */
  useEffect(() => {
    /* Skip fetch for temp (not-yet-created) conversations */
    if (conversationId.startsWith("temp-")) {
      setIsLoading(false);
      setHasMore(false);
      return;
    }
    if (initialMessages.length > 0) { setIsLoading(false); setHasMore(false); return; }
    let cancelled = false;
    async function fetchHistory() {
      try {
        const res = await fetch(
          `/api/messages/history?conversation_id=${conversationId}`
        );
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          const normalized = (data.messages ?? []).map(normalizeMessage);
          setMessages(normalized);
          setHasMore(data.has_more);
          nextCursorRef.current = data.next_cursor;
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) { console.error(err); setIsLoading(false); }
      }
    }
    fetchHistory();
    return () => { cancelled = true; };
  }, [conversationId, currentUserId, initialMessages.length]);

  /* ---- Pusher --------------------------------------------------- */
  useEffect(() => {
    const channel = pusherClient.subscribe(channelName) as Channel;
    channelRef.current = channel;

    function handleNewMessage(data: ChatChannelEvents["new-message"]) {
      const incoming: ChatMessage = {
        id: data.id, conversation_id: data.conversation_id, sender_id: data.sender_id,
        sender_name: data.sender_name ?? "", reply_to_id: data.reply_to_id,
        reply_to_content: data.reply_to_content, reply_to_sender_name: data.reply_to_sender_name,
        content: data.content, type: data.type, status: data.status,
        vanish_mode: data.vanish_mode, ephemeral_seconds: data.ephemeral_seconds,
        voice_duration: data.voice_duration, waveform_data: data.waveform_data,
        reactions: data.reactions ?? {}, created_at: data.created_at,
      };
      setMessages((prev) => prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]);
      if (data.sender_id !== currentUserId) {
        fetch("/api/messages/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversation_id: data.conversation_id, message_ids: [data.id] }),
        }).catch(() => {});
      }
    }

    function handleDelivered(data: ChatChannelEvents["delivered"]) {
      setMessages((prev) => prev.map((m) =>
        m.id === data.message_id && m.sender_id === currentUserId && m.status === "sent"
          ? { ...m, status: "delivered" as const } : m
      ));
    }

    function handleRead(data: ChatChannelEvents["read"]) {
      setMessages((prev) => prev.map((m) =>
        data.message_ids.includes(m.id) && m.sender_id === currentUserId
          ? { ...m, status: "read" as const } : m
      ));
    }

    function handleVanish(data: ChatChannelEvents["vanish"]) {
      setMessages((prev) => prev.filter((m) => m.id !== data.message_id));
    }

    function handleReaction(data: ChatChannelEvents["reaction"]) {
      setMessages((prev) => prev.map((m) => {
        if (m.id !== data.message_id) return m;
        const reactions = { ...m.reactions };
        if (data.add) {
          const arr = reactions[data.emoji] || [];
          if (!arr.includes(data.user_id)) reactions[data.emoji] = [...arr, data.user_id];
        } else {
          const arr = (reactions[data.emoji] || []).filter((id) => id !== data.user_id);
          if (arr.length === 0) delete reactions[data.emoji];
          else reactions[data.emoji] = arr;
        }
        return { ...m, reactions };
      }));
    }

    function handleTypingStart(data: ChatChannelEvents["typing-start"]) {
      if (data.user_id !== currentUserId) setIsPartnerTyping(true);
    }
    function handleTypingStop(data: ChatChannelEvents["typing-stop"]) {
      if (data.user_id !== currentUserId) setIsPartnerTyping(false);
    }

    channel.bind("new-message", handleNewMessage);
    channel.bind("delivered", handleDelivered);
    channel.bind("read", handleRead);
    channel.bind("vanish", handleVanish);
    channel.bind("reaction", handleReaction);
    channel.bind("typing-start", handleTypingStart);
    channel.bind("typing-stop", handleTypingStop);

    return () => {
      channel.unbind("new-message", handleNewMessage);
      channel.unbind("delivered", handleDelivered);
      channel.unbind("read", handleRead);
      channel.unbind("vanish", handleVanish);
      channel.unbind("reaction", handleReaction);
      channel.unbind("typing-start", handleTypingStart);
      channel.unbind("typing-stop", handleTypingStop);
      pusherClient.unsubscribe(channelName);
      channelRef.current = undefined;
    };
  }, [channelName, currentUserId]);

  /* ---- Send ----------------------------------------------------- */
  const sendMessage = useCallback(
    async (content: string, opts: SendMessageOptions = {}) => {
      if (!content.trim()) return;
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimistic: ChatMessage = {
        id: tempId, conversation_id: conversationId, sender_id: currentUserId,
        sender_name: "", reply_to_id: opts.reply_to_id ?? null,
        reply_to_content: null, reply_to_sender_name: null,
        content, type: opts.type ?? "text", status: "sending",
        vanish_mode: opts.vanish_mode ?? false,
        ephemeral_seconds: opts.ephemeral_seconds ?? null,
        voice_duration: opts.voice_duration ?? null,
        waveform_data: opts.waveform_data ?? null,
        reactions: {}, created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      try {
        const res = await fetch("/api/messages/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversation_id: conversationId, content, ...opts }),
        });
        if (!res.ok) throw new Error(`Send failed: ${res.status}`);
        const persisted: ChatMessage = await res.json();
        setMessages((prev) => prev.map((m) => (m.id === tempId ? persisted : m)));
      } catch (err) {
        console.error("[useChat] sendMessage error:", err);
        setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, status: "failed" as const } : m));
      }
    },
    [conversationId, currentUserId]
  );

  const markAsRead = useCallback(async (messageIds: string[]) => {
    if (messageIds.length === 0) return;
    try {
      await fetch("/api/messages/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: conversationId, message_ids: messageIds }),
      });
    } catch (err) { console.error(err); }
  }, [conversationId, currentUserId]);

  const vanishMessage = useCallback(async (messageId: string) => {
    try {
      await fetch("/api/messages/vanish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: conversationId, message_id: messageId }),
      });
    } catch (err) { console.error(err); }
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, [conversationId, currentUserId]);

  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      await fetch("/api/messages/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: conversationId, message_id: messageId }),
      });
    } catch (err) { console.error(err); }
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, [conversationId, currentUserId]);

  const sendReaction = useCallback((messageId: string, emoji: string, add: boolean) => {
    setMessages((prev) => prev.map((m) => {
      if (m.id !== messageId) return m;
      const reactions = { ...m.reactions };
      if (add) {
        const arr = reactions[emoji] || [];
        if (!arr.includes(currentUserId)) reactions[emoji] = [...arr, currentUserId];
      } else {
        const arr = (reactions[emoji] || []).filter((id) => id !== currentUserId);
        if (arr.length === 0) delete reactions[emoji]; else reactions[emoji] = arr;
      }
      return { ...m, reactions };
    }));
    fetch("/api/messages/reaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: conversationId, message_id: messageId, emoji, add }),
    }).catch(console.error);
  }, [conversationId, currentUserId]);

  const onTyping = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;
    channel.trigger("client-typing-start", { user_id: currentUserId });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      channel.trigger("client-typing-stop", { user_id: currentUserId });
      typingTimerRef.current = null;
    }, TYPING_DEBOUNCE_MS);
  }, [currentUserId]);

  /* ---- Load older messages (pagination) ---------------------------- */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !nextCursorRef.current) return;
    setLoadingMore(true);
    try {
      const cursor = nextCursorRef.current;
      const res = await fetch(
        `/api/messages/history?conversation_id=${conversationId}&before=${encodeURIComponent(cursor)}`
      );
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const older = (data.messages ?? []).map(normalizeMessage).filter((m) => !existingIds.has(m.id));
        return [...older, ...prev];
      });
      setHasMore(data.has_more);
      nextCursorRef.current = data.next_cursor;
    } catch (err) {
      console.error("[useChat] loadMore error:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [conversationId, loadingMore, hasMore]);

  /* ---- Cleanup typing timer on unmount ------------------------------ */
  useEffect(() => { return () => { if (typingTimerRef.current) clearTimeout(typingTimerRef.current); }; }, []);

  return { messages, isLoading, isPartnerTyping, partnerStatus, sendMessage, onTyping, markAsRead, vanishMessage, deleteMessage, sendReaction, loadMore, hasMore, loadingMore };
}
