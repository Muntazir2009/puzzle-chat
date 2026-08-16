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
  status: "sent" | "delivered" | "read";
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
  /** Append the user's own optimistic message and persist via API. */
  sendMessage: (content: string, type?: "text" | "image" | "file") => Promise<void>;
  /** Broadcast a typing-start event. Call on every keystroke. */
  onTyping: () => void;
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
        created_at: data.created_at,
      };
      setMessages((prev) => {
        if (prev.some((m) => m.id === incoming.id)) return prev;
        return [...prev, incoming];
      });
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
    channel.bind("typing-start", handleTypingStart);
    channel.bind("typing-stop", handleTypingStop);

    return () => {
      channel.unbind("new-message", handleNewMessage);
      channel.unbind("typing-start", handleTypingStart);
      channel.unbind("typing-stop", handleTypingStop);
      pusherClient.unsubscribe(channelName);
      channelRef.current = undefined;
    };
  }, [channelName, currentUserId]);

  /* ---- Send a message -------------------------------------------- */
  const sendMessage = useCallback(
    async (content: string, type: "text" | "image" | "file" = "text") => {
      if (!content.trim()) return;

      const optimistic: ChatMessage = {
        id: crypto.randomUUID(),
        conversation_id: conversationId,
        sender_id: currentUserId,
        content,
        type,
        status: "sent",
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
          }),
        });

        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Send failed: ${res.status} ${body}`);
        }

        const persisted: ChatMessage = await res.json();

        setMessages((prev) =>
          prev.map((m) => (m.id === optimistic.id ? persisted : m))
        );
      } catch (err) {
        console.error("[useChat] sendMessage error:", err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimistic.id
              ? { ...m, status: "sent" as const }
              : m
          )
        );
      }
    },
    [conversationId, currentUserId]
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
  };
}
