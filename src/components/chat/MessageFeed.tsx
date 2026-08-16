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
import {
  ArrowDown,
  AlertCircle,
  EyeOff,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { m, AnimatePresence } from "framer-motion";
import type { ChatMessage } from "@/hooks/useChat";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const AUTO_SCROLL_THRESHOLD = 120;
const ESTIMATED_ROW_HEIGHT = 72;
const OVERSCAN = 8;
const DOUBLE_TAP_DELAY_MS = 300;

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
  /** Called with peer's unread message IDs when visible at bottom. */
  onMarkAsRead?: (messageIds: string[]) => void;
  /** Called to delete a vanish-mode message from DB. */
  onVanishMessage?: (messageId: string) => void;
}

/* ------------------------------------------------------------------ */
/*  WhatsApp-style Receipt Icons                                       */
/* ------------------------------------------------------------------ */

function ReceiptIcon({ status }: { status: ChatMessage["status"] }) {
  if (status === "sending") {
    return (
      <svg
        className="size-3.5 animate-spin text-muted-foreground/60"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M21 12a9 9 0 1 1-9-9" />
      </svg>
    );
  }
  if (status === "failed") {
    return <AlertCircle className="size-3.5 text-red-500" />;
  }
  if (status === "sent") {
    return (
      <svg className="size-3.5 text-muted-foreground/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-label="Sent">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  if (status === "delivered") {
    return (
      <svg className="size-3.5 text-muted-foreground/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-label="Delivered">
        <polyline points="18 6 7 17 2 12" />
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  /* read → 2 blue checks */
  return (
    <svg className="size-3.5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-label="Read">
      <polyline points="18 6 7 17 2 12" />
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Heart Burst Animation                                              */
/* ------------------------------------------------------------------ */

function HeartBurst({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <m.span
          key="heart"
          initial={{ opacity: 0, scale: 0.2, y: 8 }}
          animate={{ opacity: 1, scale: 1.2, y: -56 }}
          exit={{ opacity: 0, scale: 0.5, y: -80 }}
          transition={{
            type: "spring",
            stiffness: 420,
            damping: 18,
            mass: 0.7,
          }}
          className="pointer-events-none absolute left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 select-none text-4xl drop-shadow-lg"
          style={{ willChange: "transform, opacity", transform: "translate3d(0,0,0)" }}
          aria-hidden
        >
          ❤️
        </m.span>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/*  MessageBubble (Instagram gradient + WhatsApp receipts + heart)      */
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
  const [showHeart, setShowHeart] = useState(false);
  const lastTapRef = useRef(0);

  const triggerDoubleTap = useCallback(() => {
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 800);
    /* Haptic feedback on supported devices. */
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(10);
    }
  }, []);

  const handleClick = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY_MS) {
      triggerDoubleTap();
    }
    lastTapRef.current = now;
  }, [triggerDoubleTap]);

  const isFailed = message.status === "failed";

  return (
    <div
      className={cn(
        "relative flex w-full gap-2.5 px-4",
        isOwn ? "justify-end" : "justify-start"
      )}
    >
      {/* Heart burst – positioned relative to the bubble row */}
      <HeartBurst show={showHeart} />

      {!isOwn && (
        <Avatar className="mt-auto size-8 shrink-0">
          {partnerAvatar && <AvatarImage src={partnerAvatar} alt={partnerName} />}
          <AvatarFallback className="text-xs font-medium">
            {partnerName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}

      <div
        className={cn(
          "flex max-w-[75%] flex-col gap-1",
          isOwn ? "items-end" : "items-start"
        )}
      >
        {/* Bubble */}
        <div
          onClick={handleClick}
          className={cn(
            "relative cursor-default select-none rounded-2xl px-4 py-2.5 text-sm leading-relaxed transition-transform duration-100 active:scale-[0.98]",
            /* Instagram-style gradient for own messages */
            isOwn &&
              "bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-br-md shadow-sm",
            /* Dark zinc for partner messages */
            !isOwn &&
              "bg-zinc-800 text-zinc-50 rounded-bl-md shadow-sm dark:bg-zinc-700 dark:text-zinc-100",
            /* Failed state red ring */
            isFailed && "ring-2 ring-red-400/50"
          )}
          style={{ transform: "translate3d(0,0,0)" }}
        >
          {message.type === "image" ? (
            <img
              src={message.content}
              alt="Shared image"
              className="max-h-64 rounded-lg object-contain"
            />
          ) : (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          )}

          {/* Vanish mode indicator */}
          {message.vanish_mode && (
            <div className="mt-1 flex items-center gap-1 text-[10px] text-white/50">
              <EyeOff className="size-3" />
              <span>View once</span>
            </div>
          )}
        </div>

        {/* Timestamp + receipt */}
        <div
          className={cn(
            "flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground",
            isOwn && "flex-row-reverse"
          )}
        >
          <span>{formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}</span>
          {isOwn && <ReceiptIcon status={message.status} />}
        </div>

        {/* Failed hint */}
        {isFailed && (
          <span className="px-1 text-[10px] text-red-500">Failed to send. Retry.</span>
        )}
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
      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-zinc-800 px-4 py-3 shadow-sm dark:bg-zinc-700">
        <span className="flex gap-1">
          <span className="size-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:0ms]" />
          <span className="size-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:150ms]" />
          <span className="size-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:300ms]" />
        </span>
        <span className="text-xs text-zinc-400">{partnerName} is typing…</span>
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
          <Skeleton className={cn("h-16 w-48 rounded-2xl", i % 2 !== 0 && "bg-gradient-to-r from-indigo-500/20 to-purple-600/20")} />
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
      className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 cursor-pointer select-none items-center gap-1.5 rounded-full bg-indigo-500 px-4 py-2 text-xs font-medium text-white shadow-lg transition-colors duration-150 hover:bg-indigo-600 active:scale-95"
      aria-label={`Scroll to ${count} new message${count > 1 ? "s" : ""}`}
      style={{ transform: "translate3d(0,0,0)" }}
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
      <div className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/10 to-purple-600/10">
        <svg className="size-6 stroke-1 text-muted-foreground/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
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
  onMarkAsRead,
  onVanishMessage,
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

  /* Auto-mark peer's unread messages when visible at bottom. */
  useEffect(() => {
    if (!onMarkAsRead) return;
    const unread = messages.filter(
      (m) => m.sender_id !== currentUserId && m.status !== "read"
    );
    if (unread.length > 0 && isAutoScrollRef.current) {
      onMarkAsRead(unread.map((m) => m.id));
    }
  }, [messages, currentUserId, onMarkAsRead]);

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
  if (messages.length === 0 && !isPartnerTyping) return <EmptyState />;

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
