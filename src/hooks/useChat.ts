"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  pusherClient,
  getChannelName,
  type ChannelMember,
} from "@/lib/pusher-client";
import { getRoomId } from "@/lib/room";
import type { ChatChannelEvents } from "@/lib/pusher-server";
import type { PrivateChannel } from "pusher-js";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** A single message as the UI consumes it. */
export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  type: "text" | "image" | "file";
  status: "sending" | "sent" | "delivered" | "read" | "failed";
  vanish_mode: boolean;
  created_at: string;
}

export interface UseChatOptions {
  /** The authenticated user's ID. */
  currentUserId: string;
  /** The other participant's user ID. */
  otherUserId: string;
  /** Conversation ID (used when fetching / sending). */
  conversationId: string;
  /** Pre-loaded message history (avoids an extra fetch on mount). */
  initialMessages?: ChatMessage[];
}

export interface UseChatReturn {
  messages: ChatMessage[];
  /** True while the initial history fetch is in flight. */
  isLoading: boolean;
  /** The other user is currently typing. */
  isPartnerTyping: boolean;
  /** Send a message with optional vanish mode flag. */
  sendMessage: (content: string, type?: "text" | "image" | "file", vanish_mode?: boolean) => Promise<void>;
  /** Broadcast a typing-start event. Call on every keystroke. */
  onTyping: () => void;
  /** Mark peer's unread messages as read and broadcast receipt. */
  markAsRead: (messageIds: string[]) => Promise<void>;
  /** Request vanish deletion for a view-once message. */
  vanishMessage: (messageId: string) => Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

const TYPING_DEBOUNCE_MS = 2_000;

export function useChat({
  currentUserId,
  otherUserId,
  conversationId,
  initialMessages = [],
}: UseChatOptions): UseChatReturn {
  const roomId = getRoomId(currentUserId, otherUserId);
  const channelName = getChannelName(roomId);

  /* ---- State ---------------------------------------------------- */
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(initialMessages.length === 0);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);

  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<PrivateChannel | undefined>(undefined);

  /* ---- Load history on mount (only if no initial messages) ------ */
  useEffect(() => {
    if (initialMessages.length > 0) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchHistory() {
      try {
        const res = await fetch(
          `/api/messages/history?conversation_id=${conversationId}`
        );
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Failed to fetch messages: ${res.status} ${body}`);
        }
        const data: ChatMessage[] = await res.json();
        if (!cancelled) {
          setMessages(data);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[useChat] fetchHistory error:", err);
          setIsLoading(false);
        }
      }
    }

    fetchHistory();
    return () => {
      cancelled = true;
    };
  }, [conversationId, initialMessages.length]);

  /* ---- Pusher subscribe ----------------------------------------- */
  useEffect(() => {
    const channel = pusherClient.subscribe(channelName) as PrivateChannel;
    channelRef.current = channel;

    function handleNewMessage(data: ChatChannelEvents["new-message"]) {
      const incoming: ChatMessage = {
        id: data.id,
        conversation_id: data.conversation_id,
        sender_id: data.sender_id,
        content: data.content,
        type: data.type,
        status: data.status,
        vanish_mode: data.vanish_mode,
        created_at: data.created_at,
      };
      setMessages((prev) => {
        if (prev.some((m) => m.id === incoming.id)) return prev;
        return [...prev, incoming];
      });

      /* Auto-send delivered receipt for the other user's messages. */
      if (data.sender_id !== currentUserId) {
        /* Fire-and-forget: tell the sender we received it. */
        fetch("/api/messages/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_id: data.conversation_id,
            message_ids: [data.id],
          }),
        }).catch(() => {/* delivered receipt best-effort */});
      }
    }

    function handleDelivered(data: ChatChannelEvents["delivered"]) {
      /* When the peer acknowledges delivery, update our sent messages to delivered. */
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.message_id && m.sender_id === currentUserId && m.status === "sent"
            ? { ...m, status: "delivered" as const }
            : m
        )
      );
    }

    function handleRead(data: ChatChannelEvents["read"]) {
      /* The peer has read our messages. Update their status. */
      setMessages((prev) =>
        prev.map((m) =>
          data.message_ids.includes(m.id) && m.sender_id === currentUserId
            ? { ...m, status: "read" as const }
            : m
        )
      );
    }

    function handleVanish(data: ChatChannelEvents["vanish"]) {
      setMessages((prev) => prev.filter((m) => m.id !== data.message_id));
    }

    function handleTypingStart(data: ChatChannelEvents["typing-start"]) {
      if (data.user_id === currentUserId) return;
      setIsPartnerTyping(true);
    }

    function handleTypingStop(data: ChatChannelEvents["typing-stop"]) {
      if (data.user_id === currentUserId) return;
      setIsPartnerTyping(false);
    }

    channel.bind("new-message", handleNewMessage);
    channel.bind("delivered", handleDelivered);
    channel.bind("read", handleRead);
    channel.bind("vanish", handleVanish);
    channel.bind("typing-start", handleTypingStart);
    channel.bind("typing-stop", handleTypingStop);

    return () => {
      channel.unbind("new-message", handleNewMessage);
      channel.unbind("delivered", handleDelivered);
      channel.unbind("read", handleRead);
      channel.unbind("vanish", handleVanish);
      channel.unbind("typing-start", handleTypingStart);
      channel.unbind("typing-stop", handleTypingStop);
      pusherClient.unsubscribe(channelName);
      channelRef.current = undefined;
    };
  }, [channelName, currentUserId]);

  /* ---- Send a message (optimistic with temp ID) ----------------- */
  const sendMessage = useCallback(
    async (content: string, type: "text" | "image" | "file" = "text", vanish_mode = false) => {
      if (!content.trim()) return;

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const optimistic: ChatMessage = {
        id: tempId,
        conversation_id: conversationId,
        sender_id: currentUserId,
        content,
        type,
        status: "sending",
        vanish_mode,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimistic]);

      try {
        const res = await fetch("/api/messages/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_id: conversationId,
            content,
            type,
            vanish_mode,
          }),
        });

        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Send failed: ${res.status} ${body}`);
        }

        const persisted: ChatMessage = await res.json();

        /* Replace the optimistic message with the server-persisted one. */
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? persisted : m))
        );
      } catch (err) {
        console.error("[useChat] sendMessage error:", err);
        /* Mark as failed so the UI can show an error state. */
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? { ...m, status: "failed" as const }
              : m
          )
        );
      }
    },
    [conversationId, currentUserId]
  );

  /* ---- Mark messages as read ------------------------------------ */
  const markAsRead = useCallback(
    async (messageIds: string[]) => {
      if (messageIds.length === 0) return;
      try {
        await fetch("/api/messages/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_id: conversationId,
            message_ids: messageIds,
          }),
        });
      } catch (err) {
        console.error("[useChat] markAsRead error:", err);
      }
    },
    [conversationId]
  );

  /* ---- Vanish a view-once message -------------------------------- */
  const vanishMessage = useCallback(
    async (messageId: string) => {
      try {
        await fetch("/api/messages/vanish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_id: conversationId,
            message_id: messageId,
          }),
        });
      } catch (err) {
        console.error("[useChat] vanishMessage error:", err);
      }
      /* Optimistically remove from UI regardless. */
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    },
    [conversationId]
  );

  /* ---- Typing indicator ------------------------------------------ */
  const onTyping = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;

    channel.trigger("client-typing-start", { user_id: currentUserId });

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    typingTimerRef.current = setTimeout(() => {
      channel.trigger("client-typing-stop", { user_id: currentUserId });
      typingTimerRef.current = null;
    }, TYPING_DEBOUNCE_MS);
  }, [currentUserId]);

  /* ---- Cleanup typing timer on unmount --------------------------- */
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
    };
  }, []);

  return {
    messages,
    isLoading,
    isPartnerTyping,
    sendMessage,
    onTyping,
    markAsRead,
    vanishMessage,
  };
}