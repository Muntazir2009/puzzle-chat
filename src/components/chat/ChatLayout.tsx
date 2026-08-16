"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Circle, Check, CheckCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useChat, type ChatMessage, type UseChatOptions } from "@/hooks/useChat";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface ChatPartner {
  id: string;
  name: string;
  avatar_url: string | null;
}

export interface ChatLayoutProps extends UseChatOptions {
  /** The other participant's profile data. */
  partner: ChatPartner;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StatusIcon({ status }: { status: ChatMessage["status"] }) {
  switch (status) {
    case "sent":
      return <Clock className="size-3.5 text-muted-foreground" />;
    case "delivered":
      return <Check className="size-3.5 text-muted-foreground" />;
    case "read":
      return <CheckCheck className="size-3.5 text-primary" />;
  }
}

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
    <div
      className={cn(
        "flex w-full gap-2.5",
        isOwn ? "justify-end" : "justify-start"
      )}
    >
      {/* Partner avatar on the left */}
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
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isOwn
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-muted text-foreground rounded-bl-md"
          )}
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
        </div>

        <div
          className={cn(
            "flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground",
            isOwn && "flex-row-reverse"
          )}
        >
          <span>
            {formatDistanceToNow(new Date(message.created_at), {
              addSuffix: true,
            })}
          </span>
          {isOwn && <StatusIcon status={message.status} />}
        </div>
      </div>

      {/* Own avatar placeholder space on the right */}
      {isOwn && <div className="w-8 shrink-0" />}
    </div>
  );
}

function TypingIndicator({ partnerName }: { partnerName: string }) {
  return (
    <div className="flex items-end gap-2.5">
      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-muted px-4 py-3">
        <span className="flex gap-1">
          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:0ms]" />
          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:150ms]" />
          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:300ms]" />
        </span>
        <span className="text-xs text-muted-foreground">
          {partnerName} is typing…
        </span>
      </div>
    </div>
  );
}

function MessageListSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-4 py-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "flex gap-2.5",
            i % 2 === 0 ? "justify-start" : "justify-end"
          )}
        >
          {i % 2 === 0 && <Skeleton className="size-8 shrink-0 rounded-full" />}
          <Skeleton className="h-16 w-48 rounded-2xl" />
          {i % 2 !== 0 && <div className="w-8 shrink-0" />}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main layout                                                        */
/* ------------------------------------------------------------------ */

export function ChatLayout({
  currentUserId,
  otherUserId,
  conversationId,
  partner,
  initialMessages,
}: ChatLayoutProps) {
  const { messages, isLoading, isPartnerTyping, sendMessage, onTyping } =
    useChat({
      currentUserId,
      otherUserId,
      conversationId,
      initialMessages,
    });

  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* Auto-scroll to bottom on new messages or typing indicator change. */
  useEffect(() => {
    if (!scrollRef.current) return;
    const viewport = scrollRef.current.querySelector(
      "[data-slot=scroll-area-viewport]"
    );
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages, isPartnerTyping]);

  /* Focus the input on mount. */
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const trimmed = draft.trim();
      if (!trimmed || isSending) return;

      setIsSending(true);
      setDraft("");

      try {
        await sendMessage(trimmed);
      } finally {
        setIsSending(false);
        inputRef.current?.focus();
      }
    },
    [draft, isSending, sendMessage]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const form = e.currentTarget.closest("form");
        if (form) form.requestSubmit();
      }
    },
    []
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setDraft(e.target.value);
      onTyping();
    },
    [onTyping]
  );

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      {/* ---- Header ------------------------------------------------- */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <Avatar className="size-9">
          {partner.avatar_url && (
            <AvatarImage src={partner.avatar_url} alt={partner.name} />
          )}
          <AvatarFallback className="text-xs font-semibold">
            {partner.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="text-sm font-semibold leading-tight">
            {partner.name}
          </span>
          <span className="text-xs text-muted-foreground">
            {isPartnerTyping ? "typing…" : "Online"}
          </span>
        </div>
      </header>

      {/* ---- Message feed ------------------------------------------- */}
      <ScrollArea ref={scrollRef} className="flex-1">
        <div className="flex flex-col gap-3 px-4 py-4">
          {isLoading ? (
            <MessageListSkeleton />
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
              <Circle className="size-10 stroke-1" />
              <p className="text-sm">No messages yet. Say hello!</p>
            </div>
          ) : (
            messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isOwn={msg.sender_id === currentUserId}
                partnerName={partner.name}
                partnerAvatar={partner.avatar_url}
              />
            ))
          )}
          {isPartnerTyping && <TypingIndicator partnerName={partner.name} />}
        </div>
      </ScrollArea>

      {/* ---- Input bar ---------------------------------------------- */}
      <div className="shrink-0 border-t bg-background px-4 py-3">
        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-2"
        >
          <textarea
            ref={inputRef}
            value={draft}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            rows={1}
            className={cn(
              "flex-1 resize-none rounded-xl border bg-muted/50 px-4 py-2.5 text-sm",
              "placeholder:text-muted-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              "max-h-32 overflow-y-auto",
              "transition-[box-shadow] duration-150"
            )}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!draft.trim() || isSending}
            className="size-10 shrink-0 rounded-xl"
            aria-label="Send message"
          >
            <ArrowUp className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
