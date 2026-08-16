"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  pusherClient,
  getChannelName,
  setDemoUserId,
} from "@/lib/pusher-client";
import { getRoomId } from "@/lib/room";
import type { ChatChannelEvents } from "@/lib/pusher-server";
import type { PrivateChannel } from "pusher-js";

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
  sendMessage: (content: string, opts?: SendMessageOptions) => Promise<void>;
  onTyping: () => void;
  markAsRead: (messageIds: string[]) => Promise<void>;
  vanishMessage: (messageId: string) => Promise<void>;
  sendReaction: (messageId: string, emoji: string, add: boolean) => void;
}

const TYPING_DEBOUNCE_MS = 2_000;

/**
 * Build headers that include the demo user ID so the server can
 * authenticate the request even without a Supabase session cookie.
 */
function authHeaders(currentUserId: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-demo-user-id": currentUserId,
    ...extra,
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

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(initialMessages.length === 0);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<PrivateChannel | undefined>(undefined);

  /* ---- Load history --------------------------------------------- */
  useEffect(() => {
    if (initialMessages.length > 0) { setIsLoading(false); return; }
    let cancelled = false;
    async function fetchHistory() {
      try {
        const res = await fetch(
          `/api/messages/history?conversation_id=${conversationId}`,
          { headers: { "x-demo-user-id": currentUserId } }
        );
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        const data: ChatMessage[] = await res.json();
        if (!cancelled) { setMessages(data); setIsLoading(false); }
      } catch (err) {
        if (!cancelled) { console.error(err); setIsLoading(false); }
      }
    }
    fetchHistory();
    return () => { cancelled = true; };
  }, [conversationId, currentUserId, initialMessages.length]);

  /* ---- Pusher --------------------------------------------------- */
  useEffect(() => {
    setDemoUserId(currentUserId);
    const channel = pusherClient.subscribe(channelName) as PrivateChannel;
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
          headers: authHeaders(currentUserId),
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
          headers: authHeaders(currentUserId),
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
        headers: authHeaders(currentUserId),
        body: JSON.stringify({ conversation_id: conversationId, message_ids: messageIds }),
      });
    } catch (err) { console.error(err); }
  }, [conversationId, currentUserId]);

  const vanishMessage = useCallback(async (messageId: string) => {
    try {
      await fetch("/api/messages/vanish", {
        method: "POST",
        headers: authHeaders(currentUserId),
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
      headers: authHeaders(currentUserId),
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

  useEffect(() => { return () => { if (typingTimerRef.current) clearTimeout(typingTimerRef.current); }; }, []);

  return { messages, isLoading, isPartnerTyping, sendMessage, onTyping, markAsRead, vanishMessage, sendReaction };
}
