"use client";

import {
  type UIEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, Check, CheckCheck, Clock, Circle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { m } from "framer-motion";
import type { ChatMessage } from "@/hooks/useChat";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const AUTO_SCROLL_THRESHOLD = 120;
const ESTIMATED_ROW_HEIGHT = 72;
const OVERSCAN = 8;

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface MessageFeedProps {
  messages: ChatMessage[];
  isLoading: boolean;
  isPartnerTyping: boolean;
  currentUserId: string;
  partnerName: string;
  partnerAvatar: string | null;
}

/* ------------------------------------------------------------------ */
/*  StatusIcon                                                         */
/* ------------------------------------------------------------------ */

function StatusIcon({ status }: { status: ChatMessage["status"] }) {
  if (status === "sent") return <Clock className="size-3.5 text-muted-foreground" />;
  if (status === "delivered") return <Check className="size-3.5 text-muted-foreground" />;
  return <CheckCheck className="size-3.5 text-primary" />;
}

/* ------------------------------------------------------------------ */
/*  MessageBubble                                                      */
/* ------------------------------------------------------------------ */

function MessageBubble({
  message,
  isOwn,
  partnerName,
  partnerAvatar,
}: {
  message: ChatMessage;
  isOwn: boolean;
  partnerName: string;
  partnerAvatar: string | null;
}) {
  return (
    <div className={cn("flex w-full gap-2.5 px-4", isOwn ? "justify-end" : "justify-start")}>
      {!isOwn && (
        <Avatar className="mt-auto size-8 shrink-0">
          {partnerAvatar && <AvatarImage src={partnerAvatar} alt={partnerName} />}
          <AvatarFallback className="text-xs font-medium">
            {partnerName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}

      <div className={cn("flex max-w-[75%] flex-col gap-1", isOwn ? "items-end" : "items-start")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isOwn ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted text-foreground rounded-bl-md"
          )}
        >
          {message.type === "image" ? (
            <img src={message.content} alt="Shared image" className="max-h-64 rounded-lg object-contain" />
          ) : (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          )}
        </div>

        <div className={cn("flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground", isOwn && "flex-row-reverse")}>
          <span>{formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}</span>
          {isOwn && <StatusIcon status={message.status} />}
        </div>
      </div>

      {isOwn && <div className="w-8 shrink-0" />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TypingIndicator                                                    */
/* ------------------------------------------------------------------ */

function TypingIndicator({ partnerName }: { partnerName: string }) {
  return (
    <div className="flex items-end gap-2.5 px-4">
      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-muted px-4 py-3">
        <span className="flex gap-1">
          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:0ms]" />
          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:150ms]" />
          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:300ms]" />
        </span>
        <span className="text-xs text-muted-foreground">{partnerName} is typing…</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MessageListSkeleton                                                */
/* ------------------------------------------------------------------ */

function MessageListSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-4 py-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={cn("flex gap-2.5", i % 2 === 0 ? "justify-start" : "justify-end")}>
          {i % 2 === 0 && <Skeleton className="size-8 shrink-0 rounded-full" />}
          <Skeleton className="h-16 w-48 rounded-2xl" />
          {i % 2 !== 0 && <div className="w-8 shrink-0" />}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  NewMessagesButton (animated via Framer Motion domMax)              */
/* ------------------------------------------------------------------ */

function NewMessagesButton({ onClick, count }: { onClick: () => void; count: number }) {
  return (
    <m.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 16, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 cursor-pointer select-none items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-lg transition-colors duration-150 hover:bg-primary/90 active:scale-95"
      aria-label={`Scroll to ${count} new message${count > 1 ? "s" : ""}`}
    >
      <ArrowDown className="size-3.5" />
      <span>{count} new message{count > 1 ? "s" : ""}</span>
    </m.button>
  );
}

/* ------------------------------------------------------------------ */
/*  EmptyState                                                         */
/* ------------------------------------------------------------------ */

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
      <Circle className="size-10 stroke-1" />
      <p className="text-sm">No messages yet. Say hello!</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MessageFeed (main export)                                          */
/* ------------------------------------------------------------------ */

export function MessageFeed({
  messages,
  isLoading,
  isPartnerTyping,
  currentUserId,
  partnerName,
  partnerAvatar,
}: MessageFeedProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const isAutoScrollRef = useRef(true);
  const [showNewMessagesBtn, setShowNewMessagesBtn] = useState(false);
  const unreadCountRef = useRef(0);
  const prevMessageCountRef = useRef(messages.length);

  const totalItems = useMemo(
    () => messages.length + (isPartnerTyping ? 1 : 0),
    [messages.length, isPartnerTyping]
  );

  const virtualizer = useVirtualizer({
    count: totalItems,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: OVERSCAN,
    paddingStart: 16,
    paddingEnd: 16,
    gap: 12,
  });

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = parentRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    isAutoScrollRef.current = true;
    setShowNewMessagesBtn(false);
    unreadCountRef.current = 0;
  }, []);

  const handleScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom <= AUTO_SCROLL_THRESHOLD) {
      isAutoScrollRef.current = true;
      setShowNewMessagesBtn(false);
      unreadCountRef.current = 0;
    } else {
      isAutoScrollRef.current = false;
    }
  }, []);

  /* Scroll to bottom after first load. */
  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => { scrollToBottom("instant"); });
    }
  }, [isLoading, scrollToBottom]);

  /* Deterministic auto-scroll on new messages. */
  useEffect(() => {
    const prevCount = prevMessageCountRef.current;
    const newCount = messages.length;
    prevMessageCountRef.current = newCount;

    if (newCount <= prevCount) return;

    const lastMsg = messages[newCount - 1];
    const isOwnMessage = lastMsg !== undefined && lastMsg.sender_id === currentUserId;

    if (isOwnMessage) {
      requestAnimationFrame(() => { scrollToBottom("instant"); });
      return;
    }

    if (isAutoScrollRef.current) {
      requestAnimationFrame(() => { scrollToBottom("smooth"); });
    } else {
      unreadCountRef.current += newCount - prevCount;
      setShowNewMessagesBtn(true);
    }
  }, [messages.length, currentUserId, scrollToBottom]);

  /* ---- Render --------------------------------------------------- */

  if (isLoading) return <MessageListSkeleton />;
  if (messages.length === 0) return <EmptyState />;

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        ref={parentRef}
        onScroll={handleScroll}
        className="h-full w-full overflow-y-auto overscroll-contain"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualItems.map((virtualItem) => {
            const isTypingRow = virtualItem.index === messages.length;
            const message = isTypingRow ? null : messages[virtualItem.index];

            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                {isTypingRow ? (
                  <TypingIndicator partnerName={partnerName} />
                ) : message ? (
                  <MessageBubble
                    message={message}
                    isOwn={message.sender_id === currentUserId}
                    partnerName={partnerName}
                    partnerAvatar={partnerAvatar}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {showNewMessagesBtn && unreadCountRef.current > 0 && (
        <NewMessagesButton count={unreadCountRef.current} onClick={() => scrollToBottom("smooth")} />
      )}
    </div>
  );
}
