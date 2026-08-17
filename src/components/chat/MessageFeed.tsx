"use client";

import React, {
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
  Reply,
  Play,
  Pause,
  Copy,
  Trash2,
  X,
  ZoomIn,
  Forward,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { m, AnimatePresence } from "framer-motion";
import type { ChatMessage } from "@/hooks/useChat";
import { toast } from "@/hooks/use-toast";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const AUTO_SCROLL_THRESHOLD = 120;
const ESTIMATED_ROW_HEIGHT = 96;
const OVERSCAN = 8;
const LONG_PRESS_MS = 500;
const REACTION_EMOJIS = [
  "\u{1F44D}",
  "\u2764\uFE0F",
  "\u{1F602}",
  "\u{1F62E}",
  "\u{1F622}",
  "\u{1F64F}",
  "\u{1F525}",
  "\u{1F389}",
];

/* ------------------------------------------------------------------ */
/*  Double-tap hook                                                      */
/* ------------------------------------------------------------------ */

function useDoubleTap(
  onDoubleTap: () => void,
  delay = 300,
) {
  const lastTapRef = useRef(0);
  return useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < delay) {
      onDoubleTap();
      lastTapRef.current = 0; // reset
    } else {
      lastTapRef.current = now;
    }
  }, [onDoubleTap, delay]);
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface MessageFeedProps {
  messages: ChatMessage[];
  isLoading: boolean;
  isPartnerTyping: boolean;
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar: string | null;
  partnerName: string;
  partnerAvatar: string | null;
  backgroundStyle?: React.CSSProperties;
  onMarkAsRead?: (ids: string[]) => void;
  onVanishMessage?: (id: string) => void;
  onReplyTo?: (message: ChatMessage) => void;
  onDeleteMessage?: (id: string) => void;
  onReact?: (messageId: string, emoji: string, add: boolean) => void;
  scrollToMessageId?: string | null;
  onScrolledToMessage?: () => void;
  searchHighlight?: string;
  onClearSearchHighlight?: () => void;
  loadMore?: () => Promise<void>;
  hasMore?: boolean;
  loadingMore?: boolean;
}

/* ------------------------------------------------------------------ */
/*  ReceiptIcon                                                        */
/* ------------------------------------------------------------------ */

function ReceiptIcon({ status }: { status: ChatMessage["status"] }) {
  if (status === "sending")
    return (
      <svg
        className="size-3 animate-spin text-muted-foreground/60"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12a9 9 0 1 1-9-9" />
      </svg>
    );
  if (status === "failed")
    return <AlertCircle className="size-3 text-red-500" />;
  const double = status !== "sent";
  return (
    <svg
      className="size-3 opacity-60 text-muted-foreground"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label={status}
      style={{
        color: status === "read" ? "var(--app-accent-light)" : undefined,
      }}
    >
      {double && <polyline points="18 6 7 17 2 12" />}
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Ephemeral Timer (circular SVG countdown)                           */
/* ------------------------------------------------------------------ */

function EphemeralTimer({
  seconds,
  onExpire,
}: {
  seconds: number;
  onExpire: () => void;
}) {
  const [remaining, setRemaining] = useState(seconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(intervalRef.current);
          onExpire();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [seconds, onExpire]);

  const pct = remaining / seconds;
  const circ = 2 * Math.PI * 7;
  const offset = circ * (1 - pct);

  return (
    <svg
      className="size-3.5 shrink-0 ephemeral-timer-pulse"
      viewBox="0 0 18 18"
      aria-label={`${remaining}s remaining`}
    >
      <circle
        cx="9"
        cy="9"
        r="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-white/20"
      />
      <circle
        cx="9"
        cy="9"
        r="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{
          color: "var(--app-accent-lighter)",
          transform: "rotate(-90deg)",
          transformOrigin: "50% 50%",
          transition: "stroke-dashoffset 1s linear",
        }}
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Message Action Sheet (single-tap action menu)                     */
/* ------------------------------------------------------------------ */

function MessageActionSheet({
  isOwn,
  onReply,
  onCopy,
  onDelete,
  onForward,
}: {
  isOwn: boolean;
  onReply: () => void;
  onCopy: () => void;
  onDelete?: () => void;
  onForward: () => void;
}) {
  return (
    <m.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 max-w-[calc(100vw-2rem)] rounded-2xl bg-neutral-900/90 border border-white/10 shadow-2xl backdrop-blur-xl transform-gpu will-change-transform"
      style={{ willChange: "transform, opacity" }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1 px-2 py-2">
        <button
          type="button"
          onClick={onReply}
          className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors duration-150 hover:bg-white/10 active:scale-95 group"
          aria-label="Reply"
        >
          <Reply className="size-4 text-white group-hover:text-[var(--app-accent)]" />
          <span className="text-[10px] text-zinc-400 group-hover:text-[var(--app-accent)]">
            Reply
          </span>
        </button>
        <button
          type="button"
          onClick={onCopy}
          className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors duration-150 hover:bg-white/10 active:scale-95 group"
          aria-label="Copy"
        >
          <Copy className="size-4 text-white group-hover:text-[var(--app-accent)]" />
          <span className="text-[10px] text-zinc-400 group-hover:text-[var(--app-accent)]">
            Copy
          </span>
        </button>
        {isOwn && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors duration-150 hover:bg-white/10 active:scale-95"
            aria-label="Delete"
          >
            <Trash2 className="size-4 text-red-400" />
            <span className="text-[10px] text-red-400">Delete</span>
          </button>
        )}
        <button
          type="button"
          onClick={onForward}
          className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors duration-150 hover:bg-white/10 active:scale-95 group"
          aria-label="Forward"
        >
          <Forward className="size-4 text-white group-hover:text-[var(--app-accent)]" />
          <span className="text-[10px] text-zinc-400 group-hover:text-[var(--app-accent)]">
            Forward
          </span>
        </button>
      </div>
    </m.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tapback Dock (long-press emoji reactions)                          */
/* ------------------------------------------------------------------ */

function TapbackDock({
  message,
  isOwn,
  onReact,
  onReply,
  onCopy,
  onDelete,
}: {
  message: ChatMessage;
  isOwn: boolean;
  onReact: (emoji: string, add: boolean) => void;
  onReply: () => void;
  onCopy: () => void;
  onDelete?: () => void;
}) {
  const [showMore, setShowMore] = useState(false);
  const primaryEmojis = REACTION_EMOJIS.slice(0, 4);
  const extraEmojis = REACTION_EMOJIS.slice(4);
  return (
    <m.div
      initial={{ opacity: 0, scale: 0.8, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 4 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={cn(
        "absolute z-50 flex items-center gap-0.5 rounded-2xl bg-neutral-900/90 border border-white/10 px-1 py-1 shadow-2xl backdrop-blur-xl transform-gpu",
        isOwn ? "right-1" : "left-1",
        "-top-12",
      )}
      style={{ willChange: "transform, opacity" }}
    >
      {primaryEmojis.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onReact(emoji, true);
          }}
          className="flex size-8 items-center justify-center rounded-xl text-base transition-all duration-150 hover:scale-125 hover:bg-white/10 active:scale-95"
          aria-label={`React ${emoji}`}
        >
          {emoji}
        </button>
      ))}
      {extraEmojis.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowMore((v) => !v);
            }}
            className="flex size-8 items-center justify-center rounded-xl text-xs font-bold text-zinc-400 transition-all duration-150 hover:bg-white/10"
            aria-label="More reactions"
          >
            +
          </button>
          <AnimatePresence>
            {showMore && (
              <m.div
                initial={{ opacity: 0, scale: 0.9, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 4 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute bottom-full left-1/2 z-50 mb-1 flex -translate-x-1/2 items-center gap-0.5 rounded-2xl bg-neutral-900/90 border border-white/10 px-1 py-1 shadow-2xl backdrop-blur-xl transform-gpu"
              >
                {extraEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReact(emoji, true);
                      setShowMore(false);
                    }}
                    className="flex size-8 items-center justify-center rounded-xl text-base transition-all duration-150 hover:scale-125 hover:bg-white/10 active:scale-95"
                  >
                    {emoji}
                  </button>
                ))}
              </m.div>
            )}
          </AnimatePresence>
        </div>
      )}
      <div className="mx-0.5 h-4 w-px bg-zinc-700" />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onCopy();
        }}
        className="flex size-8 items-center justify-center rounded-xl text-zinc-400 transition-all duration-150 hover:text-zinc-200 hover:bg-white/10 active:scale-95"
        aria-label="Copy message"
      >
        <Copy className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onReply();
        }}
        className="flex size-8 items-center justify-center rounded-xl text-zinc-400 transition-all duration-150 hover:text-zinc-200 hover:bg-white/10 active:scale-95"
        aria-label="Reply"
      >
        <Reply className="size-3.5" />
      </button>
      {isOwn && onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="flex size-8 items-center justify-center rounded-xl text-zinc-500 transition-all duration-150 hover:text-red-400 hover:bg-white/10 active:scale-95"
          aria-label="Delete"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </m.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Voice Bubble                                                       */
/* ------------------------------------------------------------------ */

function VoiceBubble({
  message,
  isOwn,
  waveform,
}: {
  message: ChatMessage;
  isOwn: boolean;
  waveform: number[];
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  const speeds = [1, 1.5, 2];
  const duration = message.voice_duration ?? 0;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      if (audio.duration) setProgress(audio.currentTime / audio.duration);
    };
    const onEnd = () => setPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnd);
    };
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.playbackRate = speed;
      audio.play().catch(() => {});
      setPlaying(true);
    }
  }, [playing, speed]);

  const cycleSpeed = useCallback(() => {
    setSpeed((s) => {
      const idx = speeds.indexOf(s);
      const next = speeds[(idx + 1) % speeds.length];
      if (audioRef.current) audioRef.current.playbackRate = next;
      return next;
    });
  }, []);

  /* Build waveform bars */
  const bars = useMemo(() => {
    const count = Math.min(waveform.length, 40);
    const step = Math.max(1, Math.floor(waveform.length / count));
    return Array.from({ length: count }, (_, i) => waveform[i * step] ?? 0.1);
  }, [waveform]);

  const progressIdx = Math.floor(progress * bars.length);

  return (
    <div className={cn("flex items-center gap-3", isOwn ? "flex-row-reverse" : "")}>
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full transition-all duration-150 active:scale-95",
          isOwn
            ? "bg-white/20 hover:bg-white/30"
            : "bg-zinc-600 hover:bg-[var(--app-accent-subtle)]",
        )}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? (
          <Pause className="size-3.5 text-white" />
        ) : (
          <Play className="size-3.5 text-white ml-0.5" />
        )}
      </button>
      <div className="flex items-center gap-[2px]" style={{ height: 32 }}>
        {bars.map((amp, i) => (
          <div
            key={i}
            className="w-[2.5px] rounded-full transition-all duration-100"
            style={{
              height: `${Math.max(4, amp * 32)}px`,
              backgroundColor:
                i < progressIdx
                  ? isOwn
                    ? "rgba(255,255,255,1)"
                    : "var(--app-accent-light)"
                  : isOwn
                    ? "rgba(255,255,255,0.5)"
                    : "rgba(161,161,170,0.7)",
            }}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={cycleSpeed}
        className={cn(
          "shrink-0 text-[11px] font-semibold tabular-nums transition-colors hover:opacity-80 active:scale-95",
          isOwn ? "text-white/70" : "text-zinc-400",
        )}
      >
        {speed}x
      </button>
      <span
        className={cn(
          "shrink-0 text-[11px] tabular-nums",
          isOwn ? "text-white/50" : "text-zinc-500",
        )}
      >
        {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, "0")}
      </span>
      <audio ref={audioRef} src={message.content} preload="metadata" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LinkifiedText – detects & renders clickable URLs                   */
/* ------------------------------------------------------------------ */

const URL_REGEX = /(https?:\/\/[^\s<]+)/g;

type TextSegment =
  | { type: "text"; value: string }
  | { type: "link"; value: string };

function parseUrls(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = URL_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: "link", value: match[1] });
    lastIndex = URL_REGEX.lastIndex;
  }
  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }
  return segments;
}

/** Split a plain-text string into highlighted / non-highlighted fragments */
function highlightText(text: string, query: string): React.ReactNode[] {
  if (!query) return [text];
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\");
  const re = new RegExp(`(${escaped})`, "gi");
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <mark
        key={match.index}
        className="bg-yellow-300/60 dark:bg-yellow-400/40 rounded-sm px-0.5"
      >
        {match[1]}
      </mark>,
    );
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

export const LinkifiedText = React.memo(function LinkifiedText({
  text,
  className,
  highlight,
}: {
  text: string;
  className?: string;
  highlight?: string;
}) {
  const segments = useMemo(() => parseUrls(text), [text]);
  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.type === "link" ? (
          <a
            key={i}
            href={seg.value}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 transition-colors"
            style={{ textDecorationColor: "var(--app-accent-light)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {seg.value}
          </a>
        ) : (
          <span key={i}>
            {highlight ? highlightText(seg.value, highlight) : seg.value}
          </span>
        ),
      )}
    </span>
  );
});

/* ------------------------------------------------------------------ */
/*  Reply Preview (inside bubble)                                      */
/* ------------------------------------------------------------------ */

function ReplyPreview({
  senderName,
  content,
  isOwn,
}: {
  senderName: string;
  content: string;
  isOwn: boolean;
}) {
  return (
    <div
      className="mb-1.5 rounded-lg border-l-2 px-2.5 py-1.5"
      style={
        isOwn
          ? {
              borderLeftColor: "rgba(255,255,255,0.5)",
              backgroundColor: "rgba(255,255,255,0.08)",
            }
          : {
              borderLeftColor: "var(--app-accent-light)",
              backgroundColor: "var(--app-accent-subtle)",
            }
      }
    >
      <p
        className="text-[10px] font-bold leading-tight"
        style={{
          color: isOwn
            ? "rgba(255,255,255,0.7)"
            : "var(--app-accent-light)",
        }}
      >
        {senderName}
      </p>
      <LinkifiedText
        text={content}
        className={cn(
          "mt-0.5 truncate text-[11px] leading-snug block",
          isOwn ? "text-white/50" : "text-zinc-400",
        )}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Image Lightbox (full-screen image viewer)                          */
/* ------------------------------------------------------------------ */

function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 active:scale-95"
        aria-label="Close"
      >
        <X className="size-5" />
      </button>
      <m.img
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        src={src}
        alt="Full size image"
        className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </m.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Reaction Pills (below bubble, overlapping bottom edge)             */
/* ------------------------------------------------------------------ */

function ReactionPills({
  reactions,
  isOwn,
  onReact,
  currentUserId,
}: {
  reactions: Record<string, string[]>;
  isOwn: boolean;
  onReact: (emoji: string, add: boolean) => void;
  currentUserId: string;
}) {
  const entries = Object.entries(reactions ?? {}).filter(
    ([, ids]) => ids.length > 0,
  );
  if (entries.length === 0) return null;
  return (
    <div
      className={cn(
        "flex flex-wrap gap-1 px-1 relative -mt-1.5",
        isOwn ? "justify-end" : "justify-start",
      )}
    >
      {entries.map(([emoji, ids]) => {
        const isActive = ids.includes(currentUserId);
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onReact(emoji, !isActive)}
            className={cn(
              "reaction-pop flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-all duration-150",
              "hover:scale-105 active:scale-95",
              !isActive &&
                "border-zinc-700/80 bg-zinc-800/90 hover:bg-zinc-700/80",
            )}
            style={
              isActive
                ? isOwn
                  ? {
                      borderColor: "rgba(255,255,255,0.3)",
                      backgroundColor: "rgba(255,255,255,0.15)",
                    }
                  : {
                      borderColor: "var(--app-accent)",
                      backgroundColor: "var(--app-accent-subtle)",
                    }
                : undefined
            }
          >
            <span className="text-xs">{emoji}</span>
            <span
              className="text-[10px] font-medium tabular-nums"
              style={{
                color: isActive
                  ? isOwn
                    ? "rgba(255,255,255,0.7)"
                    : "var(--app-accent-lighter)"
                  : "rgb(161 161 170)",
              }}
            >
              {ids.length}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Bubble rounding helper for grouped messages                        */
/* ------------------------------------------------------------------ */

function getBubbleRounding({
  isFirst,
  isLast,
  isOwn,
}: {
  isFirst: boolean;
  isLast: boolean;
  isOwn: boolean;
}): string {
  if (isFirst && isLast) {
    // Single message in group (or only message)
    return isOwn
      ? "rounded-2xl rounded-br-sm"
      : "rounded-2xl rounded-bl-sm";
  }
  if (isFirst) {
    // First message of a multi-message group
    return isOwn
      ? "rounded-tl-2xl rounded-bl-2xl rounded-tr-sm rounded-br-sm"
      : "rounded-tl-2xl rounded-bl-sm rounded-tr-2xl rounded-br-sm";
  }
  if (isLast) {
    // Last message of a multi-message group
    return isOwn
      ? "rounded-tl-2xl rounded-bl-2xl rounded-tr-sm rounded-br-2xl"
      : "rounded-tl-2xl rounded-bl-2xl rounded-tr-2xl rounded-br-sm";
  }
  // Middle message
  return isOwn
    ? "rounded-tl-2xl rounded-bl-2xl rounded-tr-sm rounded-br-sm"
    : "rounded-tl-2xl rounded-bl-sm rounded-tr-2xl rounded-br-sm";
}

/* ------------------------------------------------------------------ */
/*  MessageBubble                                                      */
/* ------------------------------------------------------------------ */

function MessageBubble({
  message,
  isOwn,
  isFirst,
  isLast,
  partnerName,
  partnerAvatar,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  onReplyTo,
  onReact,
  onDeleteMessage,
  searchHighlight,
  activeActionId,
  onOpenAction,
  activeTapbackId,
  onOpenTapback,
}: {
  message: ChatMessage;
  isOwn: boolean;
  isFirst: boolean;
  isLast: boolean;
  partnerName: string;
  partnerAvatar: string | null;
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar: string | null;
  onReplyTo?: (msg: ChatMessage) => void;
  onReact?: (id: string, emoji: string, add: boolean) => void;
  onDeleteMessage?: (id: string) => void;
  searchHighlight?: string;
  activeActionId: string | null;
  onOpenAction: (id: string | null) => void;
  activeTapbackId: string | null;
  onOpenTapback: (id: string | null) => void;
}) {
  const showTapback = activeTapbackId === message.id;
  const showActionSheet = activeActionId === message.id;
  const [showLightbox, setShowLightbox] = useState<string | null>(null);
  const [showReplyArrow, setShowReplyArrow] = useState(false);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const wasDraggedRef = useRef(false);

  /* Double-tap to reaction */
  const handleDoubleTapReaction = useCallback(() => {
    if (!onReact) return;
    onReact(message.id, "\u{1F44D}", true);
  }, [message.id, onReact]);

  const doubleTap = useDoubleTap(handleDoubleTapReaction);

  const handleClick = useCallback(() => {
    clearTimeout(longPressRef.current);
    if (wasDraggedRef.current) {
      wasDraggedRef.current = false;
      return;
    }
    // Double-tap reaction
    doubleTap();
    // Toggle action sheet: close if already open for this bubble
    if (activeActionId === message.id) {
      onOpenAction(null);
    } else {
      onOpenAction(message.id);
    }
    // Always close tapback on single click
    onOpenTapback(null);
  }, [activeActionId, message.id, onOpenAction, onOpenTapback, doubleTap]);

  const handlePressStart = useCallback(() => {
    onOpenAction(null);
    onOpenTapback(null);
    longPressRef.current = setTimeout(() => {
      if (typeof navigator !== "undefined" && "vibrate" in navigator)
        navigator.vibrate(20);
      onOpenTapback(message.id);
    }, LONG_PRESS_MS);
  }, [onOpenAction, onOpenTapback, message.id]);

  const handlePressEnd = useCallback(() => {
    clearTimeout(longPressRef.current);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onOpenAction(null);
    onOpenTapback(message.id);
  }, [onOpenAction, onOpenTapback, message.id]);

  const handleCopy = useCallback(() => {
    navigator.clipboard
      ?.writeText(message.content)
      .then(() => {
        toast({
          title: "Copied to clipboard",
          description:
            message.content.length > 50
              ? message.content.slice(0, 50) + "..."
              : message.content,
        });
      })
      .catch(() => {
        toast({
          title: "Failed to copy",
          description: "Could not access clipboard",
          variant: "destructive",
        });
      });
    onOpenTapback(null);
  }, [message.content, onOpenTapback]);

  const handleDelete = useCallback(() => {
    onDeleteMessage?.(message.id);
    onOpenTapback(null);
    onOpenAction(null);
  }, [message.id, onDeleteMessage, onOpenTapback, onOpenAction]);

  const handleActionSheetCopy = useCallback(() => {
    navigator.clipboard
      ?.writeText(message.content)
      .then(() => {
        toast({
          title: "Copied to clipboard",
          description:
            message.content.length > 50
              ? message.content.slice(0, 50) + "..."
              : message.content,
        });
      })
      .catch(() => {
        toast({
          title: "Failed to copy",
          description: "Could not access clipboard",
          variant: "destructive",
        });
      });
    onOpenAction(null);
    onOpenTapback(null);
  }, [message.content, onOpenAction, onOpenTapback]);

  const handleActionSheetReply = useCallback(() => {
    onReplyTo?.(message);
    onOpenAction(null);
    onOpenTapback(null);
  }, [message, onReplyTo, onOpenAction, onOpenTapback]);

  const handleActionSheetForward = useCallback(() => {
    toast({
      title: "Forward",
      description: "Forward coming soon!",
    });
    onOpenAction(null);
    onOpenTapback(null);
  }, [onOpenAction, onOpenTapback]);

  const isFailed = message.status === "failed";
  const isVoice = message.type === "voice";
  const isText = !isVoice && message.type !== "image";
  const isNew =
    message.status === "sending" ||
    Date.now() - new Date(message.created_at).getTime() < 2000;

  const timestampText = formatDistanceToNow(
    new Date(message.created_at || Date.now()),
    { addSuffix: true },
  );

  const rounding = getBubbleRounding({ isFirst, isLast, isOwn });

  return (
    <>
      <div
        className={cn(
          "message-bubble-row relative flex w-full select-none gap-1",
          isOwn ? "justify-end" : "justify-start",
        )}
      >
        {/* Avatar column for other user's messages — always rendered for stacking */}
        {!isOwn && (
          <Avatar className={cn(
            "shrink-0 self-end ring-1 ring-white/10",
            isLast ? "size-7" : "size-7 opacity-0 pointer-events-none",
          )}>
            {partnerAvatar && (
              <AvatarImage src={partnerAvatar} alt={partnerName} />
            )}
            <AvatarFallback
              className="text-[10px] font-medium"
              style={{
                background:
                  "linear-gradient(to bottom right, var(--app-accent-lighter), var(--app-accent-light))",
                color: "var(--app-accent-dark)",
              }}
            >
              {partnerName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}

        <AnimatePresence>
          {showTapback && onReact && (
            <TapbackDock
              message={message}
              isOwn={isOwn}
              onReact={(emoji, add) => {
                onReact(message.id, emoji, add);
                onOpenTapback(null);
              }}
              onReply={() => {
                onReplyTo?.(message);
                onOpenTapback(null);
              }}
              onCopy={handleCopy}
              onDelete={isOwn ? handleDelete : undefined}
            />
          )}
        </AnimatePresence>

        <div
          className="flex max-w-[95%] sm:max-w-[85%] flex-col gap-0.5 select-none"
        >
          <m.div
            drag="x"
            dragConstraints={{ left: 0, right: 80 }}
            dragElastic={0.15}
            dragSnapToOrigin
            dragMomentum={false}
            onDrag={(_, info) => {
              if (info.offset.x < 0) return;
              wasDraggedRef.current = true;
              setShowReplyArrow(info.offset.x > 50);
            }}
            onDragEnd={(_, info) => {
              if (info.offset.x > 50 && onReplyTo) {
                onReplyTo(message);
              }
              setShowReplyArrow(false);
              wasDraggedRef.current = false;
            }}
            onClick={handleClick}
            onPointerDown={handlePressStart}
            onPointerUp={handlePressEnd}
            onPointerLeave={handlePressEnd}
            onContextMenu={handleContextMenu}
            className={cn(
              "relative cursor-default select-none px-4 py-2.5 text-sm leading-relaxed transition-shadow duration-200",
              rounding,
              !isOwn &&
                "bg-muted text-foreground shadow-sm dark:bg-zinc-800 dark:text-zinc-100",
              isFailed && "ring-2 ring-red-400/50",
              isVoice && "py-2",
              !isVoice &&
                message.type !== "image" &&
                "md:hover:shadow-md",
            )}
            style={
              {
                touchCallout: "none",
                transform: "translate3d(0,0,0)",
                background: isOwn
                  ? "linear-gradient(to right, var(--app-accent-from), var(--app-accent-to))"
                  : undefined,
              } as React.CSSProperties
            }
          >
            {/* Reply arrow indicator for swipe-to-reply */}
            <m.div
              className="absolute left-0 top-1/2 -translate-y-1/2 -ml-2 z-10"
              animate={
                showReplyArrow
                  ? { scale: 1.2, opacity: 1 }
                  : { scale: 0.5, opacity: 0 }
              }
              transition={{ duration: 0.2, ease: "easeOut" }}
              style={{ pointerEvents: "none" }}
            >
              <div
                className="size-8 rounded-full flex items-center justify-center"
                style={{ background: "var(--app-accent)" }}
              >
                <Reply className="size-4 text-white rotate-180" />
              </div>
            </m.div>

            {/* Message Action Sheet (single-tap menu) */}
            <AnimatePresence>
              {showActionSheet && (
                <MessageActionSheet
                  isOwn={isOwn}
                  onReply={handleActionSheetReply}
                  onCopy={handleActionSheetCopy}
                  onDelete={isOwn ? handleDelete : undefined}
                  onForward={handleActionSheetForward}
                />
              )}
            </AnimatePresence>

            {/* Reply quote */}
            {message.reply_to_id && message.reply_to_content && (
              <ReplyPreview
                senderName={message.reply_to_sender_name ?? ""}
                content={message.reply_to_content}
                isOwn={isOwn}
              />
            )}

            {/* Content */}
            {isText ? (
              <div className="flex items-end gap-1.5">
                <div className="min-w-0 flex-1">
                  <LinkifiedText
                    text={message.content}
                    className="whitespace-pre-wrap break-words"
                    highlight={searchHighlight}
                  />
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {message.ephemeral_seconds &&
                    message.ephemeral_seconds > 0 && (
                      <EphemeralTimer
                        seconds={message.ephemeral_seconds}
                        onExpire={() => {
                          /* trigger vanish */
                        }}
                      />
                    )}
                  <span
                    className={cn(
                      "text-[10px] leading-none mt-0.5 whitespace-nowrap",
                      isNew &&
                        "animate-[timestamp-fade_0.4s_ease_0.3s_both]",
                      isOwn
                        ? "text-white/50"
                        : "text-muted-foreground/60",
                    )}
                  >
                    {timestampText}
                  </span>
                  {isOwn && <ReceiptIcon status={message.status} />}
                </div>
              </div>
            ) : isVoice ? (
              message.waveform_data ? (
                <VoiceBubble
                  message={message}
                  isOwn={isOwn}
                  waveform={message.waveform_data}
                />
              ) : (
                <p className="text-white/60 italic">Voice message</p>
              )
            ) : (
              <div
                className="group/img relative cursor-zoom-in"
                onClick={() => setShowLightbox(message.content)}
              >
                <img
                  src={message.content}
                  alt="Shared image"
                  className="max-h-64 rounded-lg object-contain transition-opacity duration-150 group-hover/img:opacity-90"
                />
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/0 transition-colors duration-150 group-hover/img:bg-black/20">
                  <ZoomIn className="size-6 text-white opacity-0 transition-opacity duration-150 group-hover/img:opacity-80" />
                </div>
              </div>
            )}

            {/* Vanish indicator */}
            {message.vanish_mode && (
              <div className="mt-1 flex items-center gap-1 text-[10px] text-white/50">
                <EyeOff className="size-3" />
                <span>View once</span>
              </div>
            )}
          </m.div>

          {/* Timestamp + receipt for voice/image (text messages have inline timestamp) */}
          {!isText && (
            <div
              className={cn(
                "flex items-center gap-1.5 px-1 text-[10px] text-muted-foreground/60",
                isOwn && "flex-row-reverse",
              )}
            >
              {message.ephemeral_seconds &&
                message.ephemeral_seconds > 0 && (
                  <EphemeralTimer
                    seconds={message.ephemeral_seconds}
                    onExpire={() => {
                      /* trigger vanish */
                    }}
                  />
                )}
              <span
                className={cn(
                  isNew && "animate-[timestamp-fade_0.4s_ease_0.3s_both]",
                )}
              >
                {timestampText}
              </span>
              {isOwn && <ReceiptIcon status={message.status} />}
            </div>
          )}

          {/* Reactions – overlapping bubble bottom edge */}
          {onReact && message.reactions && (
            <ReactionPills
              reactions={message.reactions}
              isOwn={isOwn}
              onReact={(e, a) => onReact(message.id, e, a)}
              currentUserId={currentUserId}
            />
          )}

          {isFailed && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteMessage?.(message.id);
              }}
              className="mt-1 flex items-center gap-1 px-1 text-[10px] text-red-400 transition-colors hover:text-red-300 active:scale-95"
            >
              <AlertCircle className="size-3" />
              <span>Failed to send &middot; Tap to retry</span>
            </button>
          )}
        </div>

        {isOwn && (
          <Avatar className={cn(
            "shrink-0 self-end ring-1 ring-white/10",
            isLast ? "size-7" : "size-7 opacity-0 pointer-events-none",
          )}>
            {currentUserAvatar && <AvatarImage src={currentUserAvatar} alt={currentUserName} />}
            <AvatarFallback
              className="text-[10px] font-medium"
              style={{ background: "linear-gradient(to bottom right, var(--app-accent-from), var(--app-accent-to))", color: "var(--app-accent-dark)" }}
            >
              {currentUserName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Image Lightbox */}
      <AnimatePresence>
        {showLightbox && (
          <ImageLightbox
            src={showLightbox}
            onClose={() => setShowLightbox(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  MessageGroup                                                       */
/* ------------------------------------------------------------------ */

function MessageGroup({
  messages: groupMessages,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  partnerName,
  partnerAvatar,
  onReplyTo,
  onReact,
  onDeleteMessage,
  searchHighlight,
  activeActionId,
  onOpenAction,
  activeTapbackId,
  onOpenTapback,
}: {
  messages: ChatMessage[];
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar: string | null;
  partnerName: string;
  partnerAvatar: string | null;
  onReplyTo?: (msg: ChatMessage) => void;
  onReact?: (id: string, emoji: string, add: boolean) => void;
  onDeleteMessage?: (id: string) => void;
  searchHighlight?: string;
  activeActionId: string | null;
  onOpenAction: (id: string | null) => void;
  activeTapbackId: string | null;
  onOpenTapback: (id: string | null) => void;
}) {
  const isOwnGroup = groupMessages[0].sender_id === currentUserId;
  return (
    <div className={cn("flex flex-col gap-0.5", isOwnGroup ? "items-end" : "items-start")}>
      {groupMessages.map((msg, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === groupMessages.length - 1;
        return (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwn={isOwnGroup}
            isFirst={isFirst}
            isLast={isLast}
            partnerName={partnerName}
            partnerAvatar={partnerAvatar}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            currentUserAvatar={currentUserAvatar}
            onReplyTo={onReplyTo}
            onReact={onReact}
            onDeleteMessage={onDeleteMessage}
            searchHighlight={searchHighlight}
            activeActionId={activeActionId}
            onOpenAction={onOpenAction}
            activeTapbackId={activeTapbackId}
            onOpenTapback={onOpenTapback}
          />
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DateSeparator                                                      */
/* ------------------------------------------------------------------ */

function formatDateSeparator(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (msgDay.getTime() === today.getTime()) return "Today";
  if (msgDay.getTime() === yesterday.getTime()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-3 px-1 py-2">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
      <span className="shrink-0 rounded-full bg-background px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm ring-1 ring-[var(--app-accent-subtle)]">
        {formatDateSeparator(date)}
      </span>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TypingIndicator (smooth wave dots)                                 */
/* ------------------------------------------------------------------ */

function TypingIndicator({
  partnerName,
  partnerAvatar,
}: {
  partnerName: string;
  partnerAvatar: string | null;
}) {
  const initials = partnerName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <div className="flex items-end gap-2 px-1">
      <Avatar className="size-7 shrink-0 ring-1 ring-white/10">
        {partnerAvatar && (
          <AvatarImage src={partnerAvatar} alt={partnerName} />
        )}
        <AvatarFallback
          className="text-[10px] font-medium"
          style={{
            background:
              "linear-gradient(to bottom right, var(--app-accent-lighter), var(--app-accent-light))",
            color: "var(--app-accent-dark)",
          }}
        >
          {initials}
        </AvatarFallback>
      </Avatar>
      <m.div
        initial={{ opacity: 0, y: 8, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 4, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="flex items-center gap-2.5 rounded-2xl rounded-bl-sm bg-muted px-4 py-3 shadow-sm dark:bg-zinc-800"
      >
        <span className="flex gap-1">
          <span
            className="typing-dot size-[7px] rounded-full"
            style={{ backgroundColor: "var(--app-accent-light)" }}
          />
          <span
            className="typing-dot size-[7px] rounded-full"
            style={{ backgroundColor: "var(--app-accent-light)" }}
          />
          <span
            className="typing-dot size-[7px] rounded-full"
            style={{ backgroundColor: "var(--app-accent-light)" }}
          />
        </span>
        <span className="text-xs text-muted-foreground">
          {partnerName} is typing{"\u2026"}
        </span>
      </m.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton / Empty / NewMsgs                                         */
/* ------------------------------------------------------------------ */

function MessageListSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-1 py-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "flex gap-2",
            i % 2 === 0 ? "justify-start" : "justify-end",
          )}
        >
          {i % 2 === 0 && (
            <Skeleton className="size-7 shrink-0 rounded-full" />
          )}
          <Skeleton className={cn("h-16 w-48 rounded-2xl")} />
          {i % 2 !== 0 && <div className="w-7 shrink-0" />}
        </div>
      ))}
    </div>
  );
}

function NewMessagesButton({
  onClick,
  count,
}: {
  onClick: () => void;
  count: number;
}) {
  return (
    <m.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 16, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.9 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 cursor-pointer select-none items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium text-white shadow-lg transition-colors hover:opacity-90 active:scale-95"
      aria-label={`Scroll to ${count} new`}
      style={{
        transform: "translate3d(0,0,0)",
        background:
          "linear-gradient(to right, var(--app-accent-from), var(--app-accent-to))",
      }}
    >
      <ArrowDown className="size-3.5" />
      <span>
        {count} new message{count > 1 ? "s" : ""}
      </span>
    </m.button>
  );
}

function EmptyState({
  partnerName,
  partnerAvatar,
}: {
  partnerName: string;
  partnerAvatar: string | null;
}) {
  const initials = partnerName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <Avatar className="size-20 ring-4" style={
        { "--tw-ring-color": "var(--app-accent-lighter)" } as React.CSSProperties
      }>
        {partnerAvatar && (
          <AvatarImage src={partnerAvatar} alt={partnerName} />
        )}
        <AvatarFallback
          className="text-2xl font-bold text-white"
          style={{
            background:
              "linear-gradient(to bottom right, var(--app-accent-from), var(--app-accent-to))",
          }}
        >
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">{partnerName}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {"\uD83D\uDC4B"} No messages yet. Say hello to start the
          conversation!
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MessageFeed (main export)                                          */
/* ------------------------------------------------------------------ */

type MessageGroupData = { senderId: string; messages: ChatMessage[] };

export function MessageFeed({
  messages,
  isLoading,
  isPartnerTyping,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  partnerName,
  partnerAvatar,
  backgroundStyle,
  onMarkAsRead,
  onVanishMessage,
  onReplyTo,
  onDeleteMessage,
  onReact,
  scrollToMessageId,
  onScrolledToMessage,
  searchHighlight,
  onClearSearchHighlight,
  loadMore,
  hasMore,
  loadingMore,
}: MessageFeedProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const isAutoScrollRef = useRef(true);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [activeTapbackId, setActiveTapbackId] = useState<string | null>(null);
  const [showNewBtn, setShowNewBtn] = useState(false);
  const unreadRef = useRef(0);
  const prevCountRef = useRef(messages.length);
  const prevFirstIdRef = useRef(
    messages.length > 0 ? messages[0].id : null,
  );
  const prevScrollHeightRef = useRef(0);

  /* ---- Build message groups ---------------------------------------- */
  const groups = useMemo(() => {
    const result: MessageGroupData[] = [];
    for (const msg of messages) {
      const last = result[result.length - 1];
      if (last && last.senderId === msg.sender_id) {
        last.messages.push(msg);
      } else {
        result.push({ senderId: msg.sender_id, messages: [msg] });
      }
    }
    return result;
  }, [messages]);

  const totalItems = useMemo(
    () => groups.length + (isPartnerTyping ? 1 : 0),
    [groups.length, isPartnerTyping],
  );

  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  const virtualizer = useVirtualizer({
    count: totalItems,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: OVERSCAN,
    paddingStart: 16,
    paddingEnd: 16,
    gap: 12,
  });

  const handleScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (dist <= AUTO_SCROLL_THRESHOLD) {
        isAutoScrollRef.current = true;
        setShowNewBtn(false);
        unreadRef.current = 0;
      } else {
        isAutoScrollRef.current = false;
      }
      /* Trigger loadMore when scrolled near top */
      if (el.scrollTop < 300 && hasMore && !loadingMore) {
        loadMoreRef.current?.();
      }
    },
    [hasMore, loadingMore],
  );

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const el = parentRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior });
      isAutoScrollRef.current = true;
      setShowNewBtn(false);
      unreadRef.current = 0;
    },
    [],
  );

  useEffect(() => {
    if (messages.length > 0)
      requestAnimationFrame(() => scrollToBottom("instant"));
  }, [isLoading, scrollToBottom]);

  useEffect(() => {
    if (!onMarkAsRead) return;
    const unread = messages.filter(
      (m) => m.sender_id !== currentUserId && m.status !== "read",
    );
    if (unread.length > 0 && isAutoScrollRef.current)
      onMarkAsRead(unread.map((m) => m.id));
  }, [messages, currentUserId, onMarkAsRead]);

  /* ---- Scroll to a specific message ----------------------------------- */
  useEffect(() => {
    if (!scrollToMessageId) return;
    // Find which group contains the target message
    const groupIdx = groups.findIndex((g) =>
      g.messages.some((m) => m.id === scrollToMessageId),
    );
    if (groupIdx === -1) {
      onScrolledToMessage?.();
      return;
    }
    virtualizer.scrollToIndex(groupIdx, { align: "center" });
    onScrolledToMessage?.();
  }, [scrollToMessageId, groups, virtualizer, onScrolledToMessage]);

  /* ---- Handle message count changes (new or prepended) ------------ */
  useEffect(() => {
    const prev = prevCountRef.current;
    const prevFirstId = prevFirstIdRef.current;
    prevCountRef.current = messages.length;
    prevFirstIdRef.current =
      messages.length > 0 ? messages[0].id : null;

    if (messages.length <= prev) return;

    /* Check if older messages were prepended (first message changed) */
    const firstId = messages[0]?.id;
    const wasPrepended = firstId !== prevFirstId && prevFirstId !== null;

    if (wasPrepended) {
      /* Older messages prepended – preserve scroll position */
      const el = parentRef.current;
      if (el) {
        const oldHeight = prevScrollHeightRef.current;
        prevScrollHeightRef.current = el.scrollHeight;
        requestAnimationFrame(() => {
          const newHeight = el.scrollHeight;
          el.scrollTop += newHeight - oldHeight;
        });
      }
      return;
    }

    /* New messages appended at the end */
    const last = messages[messages.length - 1];
    const own = last && last.sender_id === currentUserId;
    if (own) {
      requestAnimationFrame(() => scrollToBottom("instant"));
      return;
    }
    if (isAutoScrollRef.current)
      requestAnimationFrame(() => scrollToBottom("smooth"));
    else {
      unreadRef.current += messages.length - prev;
      setShowNewBtn(true);
    }
  }, [messages.length, currentUserId, scrollToBottom]);

  /* Track scroll height for scroll preservation */
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    prevScrollHeightRef.current = el.scrollHeight;
  }, [messages.length]);

  if (isLoading) return <MessageListSkeleton />;
  if (messages.length === 0 && !isPartnerTyping)
    return (
      <EmptyState partnerName={partnerName} partnerAvatar={partnerAvatar} />
    );

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={backgroundStyle}
    >
      <div
        ref={parentRef}
        onScroll={handleScroll}
        onClick={(e) => {
          onClearSearchHighlight?.();
          // Close menus if click is directly on the scroll container or background
          const target = e.target as HTMLElement;
          if (target === e.currentTarget || target.closest('.message-bubble-row') === null) {
            setActiveActionId(null);
            setActiveTapbackId(null);
          }
        }}
        className="h-full w-full select-none overflow-y-auto overscroll-contain"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {/* Loading more spinner */}
          {loadingMore && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "48px",
                zIndex: 5,
              }}
            >
              <div className="flex items-center justify-center py-3">
                <svg
                  className="size-5 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-label="Loading more messages"
                  style={{ color: "var(--app-accent-light)" }}
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              </div>
            </div>
          )}
          {virtualItems.map((vi) => {
            const isTyping = vi.index === groups.length;
            const group = isTyping ? null : groups[vi.index];

            // Determine if we need a date separator before this group
            let showDateSep = false;
            if (group) {
              const firstMsg = group.messages[0];
              if (vi.index === 0) {
                showDateSep = true;
              } else {
                const prevGroup = groups[vi.index - 1];
                const prevLastMsg = prevGroup.messages[prevGroup.messages.length - 1];
                const prevDate = new Date(prevLastMsg.created_at);
                const currDate = new Date(firstMsg.created_at);
                showDateSep = prevDate.toDateString() !== currDate.toDateString();
              }
            }

            return (
              <div
                key={vi.key}
                data-index={vi.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${vi.start}px)`,
                }}
              >
                {isTyping ? (
                  <TypingIndicator
                    partnerName={partnerName}
                    partnerAvatar={partnerAvatar}
                  />
                ) : group ? (
                  <>
                    {showDateSep && (
                      <DateSeparator date={group.messages[0].created_at} />
                    )}
                    <MessageGroup
                      messages={group.messages}
                      currentUserId={currentUserId}
                      currentUserName={currentUserName}
                      currentUserAvatar={currentUserAvatar}
                      partnerName={partnerName}
                      partnerAvatar={partnerAvatar}
                      onReplyTo={onReplyTo}
                      onReact={onReact}
                      onDeleteMessage={onDeleteMessage}
                      searchHighlight={searchHighlight}
                      activeActionId={activeActionId}
                      onOpenAction={setActiveActionId}
                      activeTapbackId={activeTapbackId}
                      onOpenTapback={setActiveTapbackId}
                    />
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      {showNewBtn && unreadRef.current > 0 && (
        <NewMessagesButton
          count={unreadRef.current}
          onClick={() => scrollToBottom("smooth")}
        />
      )}
    </div>
  );
}
