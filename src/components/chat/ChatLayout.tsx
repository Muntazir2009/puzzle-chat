"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageFeed } from "@/components/chat/MessageFeed";
import { useChat, type UseChatOptions } from "@/hooks/useChat";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import { cn } from "@/lib/utils";

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
/*  ChatLayout                                                         */
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
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* ---- Mobile keyboard: use dynamic viewport height ----------- */
  const viewport = useVisualViewport();

  /* The container height tracks the visual viewport so that on iOS /
     Android the input bar stays above the keyboard. */
  const containerStyle =
    viewport.height > 0
      ? ({ height: `${viewport.height}px` } as React.CSSProperties)
      : ({ height: "100dvh" } as React.CSSProperties);

  /* On iOS when the keyboard opens the visual viewport shrinks but
     the page doesn't scroll down – we compensate by setting a negative
     margin-top equal to the visual viewport offset. */
  const keyboardOffsetStyle =
    viewport.isKeyboardVisible && viewport.offsetTop > 0
      ? ({ marginTop: `-${viewport.offsetTop}px` } as React.CSSProperties)
      : undefined;

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
        /* Re-focus the input after the keyboard may have shifted. */
        requestAnimationFrame(() => {
          inputRef.current?.focus();
        });
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

  /* Auto-resize the textarea to fit content (up to max-h-32). */
  const handleInput = useCallback(
    (e: React.FormEvent<HTMLTextAreaElement>) => {
      const el = e.currentTarget;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
    },
    []
  );

  return (
    <div
      className="flex w-full flex-col bg-background"
      style={containerStyle}
    >
      <div style={keyboardOffsetStyle} className="flex min-h-0 flex-1 flex-col">
        {/* ---- Header ---------------------------------------------- */}
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

        {/* ---- Message feed (virtualized) ------------------------- */}
        <div className="min-h-0 flex-1">
          <MessageFeed
            messages={messages}
            isLoading={isLoading}
            isPartnerTyping={isPartnerTyping}
            currentUserId={currentUserId}
            partnerName={partner.name}
            partnerAvatar={partner.avatar_url}
          />
        </div>

        {/* ---- Input bar -------------------------------------------- */}
        <div className="shrink-0 border-t bg-background px-3 py-2.5 sm:px-4 sm:py-3">
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onInput={handleInput}
              placeholder="Type a message…"
              rows={1}
              className={cn(
                "flex-1 resize-none rounded-xl border bg-muted/50 px-3 py-2.5 text-sm sm:px-4",
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
    </div>
  );
}
