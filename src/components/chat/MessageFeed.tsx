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
import { ArrowDown, AlertCircle, EyeOff, Reply, Play, Pause, Copy, Trash2, X, ZoomIn } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { m, AnimatePresence, type PanInfo } from "framer-motion";
import type { ChatMessage } from "@/hooks/useChat";
import { toast } from "@/hooks/use-toast";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const AUTO_SCROLL_THRESHOLD = 120;
const ESTIMATED_ROW_HEIGHT = 72;
const OVERSCAN = 8;
const DOUBLE_TAP_MS = 300;
const LONG_PRESS_MS = 500;
const SWIPE_REPLY_THRESHOLD = 80;
const REACTION_EMOJIS = ["\u{1F44D}", "\u2764\uFE0F", "\u{1F602}", "\u{1F62E}", "\u{1F622}", "\u{1F64F}", "\u{1F525}", "\u{1F389}"];

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
  if (status === "sending") return <svg className="size-3.5 animate-spin text-muted-foreground/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9" /></svg>;
  if (status === "failed") return <AlertCircle className="size-3.5 text-red-500" />;
  const color = status === "read" ? "text-violet-400" : "text-muted-foreground/50";
  const double = status !== "sent";
  return (
    <svg className={cn("size-3.5", color)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-label={status}>
      {double && <polyline points="18 6 7 17 2 12" />}
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Heart Burst                                                        */
/* ------------------------------------------------------------------ */

function HeartBurst({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <m.span key="heart" initial={{ opacity: 0, scale: 0.2, y: 8 }} animate={{ opacity: 1, scale: 1.2, y: -56 }} exit={{ opacity: 0, scale: 0.5, y: -80 }} transition={{ type: "spring", stiffness: 420, damping: 18, mass: 0.7 }} className="pointer-events-none absolute left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 select-none text-4xl drop-shadow-lg" style={{ willChange: "transform, opacity", transform: "translate3d(0,0,0)" }} aria-hidden>\u2764\uFE0F</m.span>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/*  Ephemeral Timer (circular SVG countdown)                           */
/* ------------------------------------------------------------------ */

function EphemeralTimer({ seconds, onExpire }: { seconds: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(seconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { clearInterval(intervalRef.current); onExpire(); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [seconds, onExpire]);

  const pct = remaining / seconds;
  const circ = 2 * Math.PI * 7;
  const offset = circ * (1 - pct);

  return (
    <svg className="size-4 shrink-0 ephemeral-timer-pulse" viewBox="0 0 18 18" aria-label={`${remaining}s remaining`}>
      <circle cx="9" cy="9" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/20" />
      <circle cx="9" cy="9" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" className="text-violet-300" style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", transition: "stroke-dashoffset 1s linear" }} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Tapback Dock (iMessage long-press reactions)                        */
/* ------------------------------------------------------------------ */

function TapbackDock({ message, isOwn, onReact, onReply, onCopy, onDelete }: {
  message: ChatMessage; isOwn: boolean; onReact: (emoji: string, add: boolean) => void; onReply: () => void; onCopy: () => void; onDelete?: () => void;
}) {
  const [showMore, setShowMore] = useState(false);
  const primaryEmojis = REACTION_EMOJIS.slice(0, 4);
  const extraEmojis = REACTION_EMOJIS.slice(4);
  return (
    <m.div
      initial={{ opacity: 0, scale: 0.8, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 4 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={cn(
        "absolute z-50 flex items-center gap-0.5 rounded-2xl bg-zinc-900 px-1 py-1 shadow-xl",
        isOwn ? "right-2" : "left-2",
        "-bottom-12"
      )}
      style={{ willChange: "transform, opacity" }}
    >
      {primaryEmojis.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={(e) => { e.stopPropagation(); onReact(emoji, true); }}
          className="flex size-8 items-center justify-center rounded-xl text-base transition-all duration-150 hover:scale-125 hover:bg-white/10 active:scale-90"
          aria-label={`React ${emoji}`}
        >{emoji}</button>
      ))}
      {extraEmojis.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowMore((v) => !v); }}
            className="flex size-8 items-center justify-center rounded-xl text-xs font-bold text-zinc-400 transition-all duration-150 hover:bg-white/10"
            aria-label="More reactions"
          >+</button>
          <AnimatePresence>
            {showMore && (
              <m.div
                initial={{ opacity: 0, scale: 0.9, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 4 }}
                className="absolute bottom-full left-1/2 z-50 mb-1 flex -translate-x-1/2 items-center gap-0.5 rounded-2xl bg-zinc-900 px-1 py-1 shadow-xl"
              >
                {extraEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onReact(emoji, true); setShowMore(false); }}
                    className="flex size-8 items-center justify-center rounded-xl text-base transition-all duration-150 hover:scale-125 hover:bg-white/10 active:scale-90"
                  >{emoji}</button>
                ))}
              </m.div>
            )}
          </AnimatePresence>
        </div>
      )}
      <div className="mx-0.5 h-4 w-px bg-zinc-700" />
      <button type="button" onClick={(e) => { e.stopPropagation(); onCopy(); }} className="flex size-8 items-center justify-center rounded-xl text-zinc-400 transition-all duration-150 hover:text-zinc-200 hover:bg-white/10" aria-label="Copy message">
        <Copy className="size-3.5" />
      </button>
      <button type="button" onClick={(e) => { e.stopPropagation(); onReply(); }} className="flex size-8 items-center justify-center rounded-xl text-zinc-400 transition-all duration-150 hover:text-zinc-200 hover:bg-white/10" aria-label="Reply">
        <Reply className="size-3.5" />
      </button>
      {isOwn && onDelete && (
        <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="flex size-8 items-center justify-center rounded-xl text-zinc-500 transition-all duration-150 hover:text-red-400 hover:bg-white/10" aria-label="Delete">
          <Trash2 className="size-3.5" />
        </button>
      )}
    </m.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Voice Bubble                                                       */
/* ------------------------------------------------------------------ */

function VoiceBubble({ message, isOwn, waveform }: {
  message: ChatMessage; isOwn: boolean; waveform: number[];
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
    const onTime = () => { if (audio.duration) setProgress(audio.currentTime / audio.duration); };
    const onEnd = () => setPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);
    return () => { audio.removeEventListener("timeupdate", onTime); audio.removeEventListener("ended", onEnd); };
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.playbackRate = speed; audio.play().catch(() => {}); setPlaying(true); }
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

  const barColor = isOwn ? "bg-white/50" : "bg-zinc-400/70";
  const progressColor = isOwn ? "bg-white" : "bg-violet-400";
  const progressIdx = Math.floor(progress * bars.length);

  return (
    <div className={cn("flex items-center gap-3", isOwn ? "flex-row-reverse" : "")}>
      <button type="button" onClick={toggle} className={cn("flex size-9 shrink-0 items-center justify-center rounded-full transition-all duration-150", isOwn ? "bg-white/20 hover:bg-white/30 hover:scale-105" : "bg-zinc-600 hover:bg-zinc-500 hover:scale-105")} aria-label={playing ? "Pause" : "Play"}>
        {playing ? <Pause className="size-3.5 text-white" /> : <Play className="size-3.5 text-white ml-0.5" />}
      </button>
      <div className="flex items-center gap-[2px]" style={{ height: 32 }}>
        {bars.map((amp, i) => (
          <div key={i} className={cn("w-[2.5px] rounded-full transition-all duration-100", i < progressIdx ? progressColor : barColor)} style={{ height: `${Math.max(4, amp * 32)}px` }} />
        ))}
      </div>
      <button type="button" onClick={cycleSpeed} className={cn("shrink-0 text-[11px] font-semibold tabular-nums transition-colors hover:opacity-80", isOwn ? "text-white/70" : "text-zinc-400")}>{speed}x</button>
      <span className={cn("shrink-0 text-[11px] tabular-nums", isOwn ? "text-white/50" : "text-zinc-500")}>{Math.floor(duration / 60)}:{String(duration % 60).padStart(2, "0")}</span>
      <audio ref={audioRef} src={message.content} preload="metadata" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LinkifiedText – detects & renders clickable URLs                   */
/* ------------------------------------------------------------------ */

const URL_REGEX = /(https?:\/\/[^\s<]+)/g;

type TextSegment = { type: "text"; value: string } | { type: "link"; value: string };

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
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(${escaped})`, "gi");
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <mark key={match.index} className="bg-yellow-300/60 dark:bg-yellow-400/40 rounded-sm px-0.5">
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

export const LinkifiedText = React.memo(function LinkifiedText({ text, className, highlight }: { text: string; className?: string; highlight?: string }) {
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
            className="underline decoration-violet-400/50 underline-offset-2 hover:decoration-violet-400 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {seg.value}
          </a>
        ) : (
          <span key={i}>{highlight ? highlightText(seg.value, highlight) : seg.value}</span>
        ),
      )}
    </span>
  );
});

/* ------------------------------------------------------------------ */
/*  Reply Preview (inside bubble)                                      */
/* ------------------------------------------------------------------ */

function ReplyPreview({ senderName, content, isOwn }: { senderName: string; content: string; isOwn: boolean }) {
  return (
    <div className={cn(
      "mb-1.5 rounded-lg px-2.5 py-1.5",
      isOwn
        ? "border-l-2 border-l-white/50 bg-white/[0.08]"
        : "border-l-2 border-l-violet-400/70 bg-violet-500/[0.08]",
    )}>
      <p className={cn("text-[10px] font-bold leading-tight", isOwn ? "text-white/70" : "text-violet-400")}>{senderName}</p>
      <LinkifiedText text={content} className={cn("mt-0.5 truncate text-[11px] leading-snug block", isOwn ? "text-white/50" : "text-zinc-400")} />
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
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        aria-label="Close"
      >
        <X className="size-5" />
      </button>
      <m.img
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        src={src}
        alt="Full size image"
        className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </m.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Reaction Pills (below bubble)                                      */
/* ------------------------------------------------------------------ */

function ReactionPills({ reactions, isOwn, onReact, currentUserId }: {
  reactions: Record<string, string[]>; isOwn: boolean; onReact: (emoji: string, add: boolean) => void; currentUserId: string;
}) {
  const entries = Object.entries(reactions ?? {}).filter(([, ids]) => ids.length > 0);
  if (entries.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1 px-1 pt-0.5", isOwn ? "justify-end" : "justify-start")}>
      {entries.map(([emoji, ids]) => {
        const isActive = ids.includes(currentUserId);
        return (
          <button key={emoji} type="button" onClick={() => onReact(emoji, !isActive)}
            className={cn(
              "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-all duration-150",
              "hover:scale-105 active:scale-95",
              "animate-[reaction-pop_0.3s_cubic-bezier(0.34,1.56,0.64,1)_both]",
              isActive
                ? (isOwn ? "border-white/30 bg-white/20 shadow-sm shadow-violet-500/20" : "border-violet-400/40 bg-violet-500/15 shadow-sm shadow-violet-500/20")
                : "border-zinc-700/80 bg-zinc-800/90 hover:bg-zinc-700/80",
            )}>
            <span className="text-xs">{emoji}</span><span className={cn("text-[10px] font-medium tabular-nums", isActive ? (isOwn ? "text-white/70" : "text-violet-300") : "text-zinc-400")}>{ids.length}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MessageBubble                                                      */
/* ------------------------------------------------------------------ */

function MessageBubble({ message, isOwn, partnerName, partnerAvatar, onReplyTo, onReact, onDeleteMessage, searchHighlight }: {
  message: ChatMessage; isOwn: boolean; partnerName: string; partnerAvatar: string | null;
  onReplyTo?: (msg: ChatMessage) => void; onReact?: (id: string, emoji: string, add: boolean) => void; onDeleteMessage?: (id: string) => void; searchHighlight?: string;
}) {
  const [showHeart, setShowHeart] = useState(false);
  const [showTapback, setShowTapback] = useState(false);
  const [showLightbox, setShowLightbox] = useState<string | null>(null);
  const lastTapRef = useRef(0);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const bubbleRef = useRef<HTMLDivElement>(null);

  const triggerHeart = useCallback(() => {
    setShowHeart(true); setTimeout(() => setShowHeart(false), 800);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(10);
  }, []);

  const handleClick = useCallback(() => {
    clearTimeout(longPressRef.current);
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) triggerHeart();
    lastTapRef.current = now;
  }, [triggerHeart]);

  const handlePressStart = useCallback(() => {
    longPressRef.current = setTimeout(() => {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(20);
      setShowTapback(true);
    }, LONG_PRESS_MS);
  }, []);

  const handlePressEnd = useCallback(() => { clearTimeout(longPressRef.current); }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); setShowTapback(true);
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard?.writeText(message.content).then(() => {
      toast({ title: "Copied to clipboard", description: message.content.length > 50 ? message.content.slice(0, 50) + "..." : message.content });
    }).catch(() => {
      toast({ title: "Failed to copy", description: "Could not access clipboard", variant: "destructive" });
    });
    setShowTapback(false);
  }, [message.content]);

  const handleDelete = useCallback(() => {
    onDeleteMessage?.(message.id);
    setShowTapback(false);
  }, [message.id, onDeleteMessage]);

  const handleSwipeEnd = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x > SWIPE_REPLY_THRESHOLD && info.velocity.x > 200) {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(10);
      onReplyTo?.(message);
    }
  }, [message, onReplyTo]);

  const isFailed = message.status === "failed";
  const isVoice = message.type === "voice";
  const isNew = message.status === "sending" || Date.now() - new Date(message.created_at).getTime() < 2000;

  return (
    <>
    <m.div
      className={cn("relative flex w-full gap-2.5 px-4", isOwn ? "justify-end" : "justify-start")}
      initial={isNew ? { opacity: 0, y: 16, scale: 0.97 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <HeartBurst show={showHeart} />
      <AnimatePresence>{showTapback && onReact && (
        <TapbackDock message={message} isOwn={isOwn} onReact={(emoji, add) => { onReact(message.id, emoji, add); setShowTapback(false); }} onReply={() => { onReplyTo?.(message); setShowTapback(false); }} onCopy={handleCopy} onDelete={isOwn ? handleDelete : undefined} />
      )}</AnimatePresence>

      {!isOwn && (
        <Avatar className="mt-auto size-8 shrink-0 ring-1 ring-muted">
          {partnerAvatar && <AvatarImage src={partnerAvatar} alt={partnerName} />}
          <AvatarFallback className="bg-gradient-to-br from-violet-100 to-purple-200 text-xs font-medium text-violet-700 dark:from-violet-500 dark:to-purple-600 dark:text-white">{partnerName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
      )}

      <div className={cn("flex max-w-[75%] flex-col gap-1", isOwn ? "items-end" : "items-start")}>
        <m.div
          ref={bubbleRef}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={{ left: 0, right: 0.35 }}
          onDragEnd={handleSwipeEnd}
          onClick={handleClick}
          onPointerDown={handlePressStart}
          onPointerUp={handlePressEnd}
          onPointerLeave={handlePressEnd}
          onContextMenu={handleContextMenu}
          className={cn(
            "relative cursor-default select-none rounded-2xl px-4 py-2.5 text-sm leading-relaxed transition-all duration-200 active:scale-[0.98]",
            // Own messages: vibrant violet-purple gradient with subtle shadow
            isOwn && "bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-br-md shadow-md shadow-violet-500/15",
            // Partner messages: softer background with shadow
            !isOwn && "bg-muted text-foreground rounded-bl-md shadow-sm dark:bg-zinc-800 dark:text-zinc-100 dark:shadow-violet-950/20",
            isFailed && "ring-2 ring-red-400/50",
            isVoice && "py-2",
            !isVoice && message.type !== "image" && "md:hover:shadow-md md:hover:-translate-y-0.5"
          )}
          style={{ transform: "translate3d(0,0,0)" }}
        >
          {/* Reply quote */}
          {message.reply_to_id && message.reply_to_content && (
            <ReplyPreview senderName={message.reply_to_sender_name ?? ""} content={message.reply_to_content} isOwn={isOwn} />
          )}

          {/* Content */}
          {isVoice ? (
            message.waveform_data ? (
              <VoiceBubble message={message} isOwn={isOwn} waveform={message.waveform_data} />
            ) : <p className="text-white/60 italic">Voice message</p>
          ) : message.type === "image" ? (
            <div className="group/img relative cursor-zoom-in" onClick={() => setShowLightbox(message.content)}>
              <img src={message.content} alt="Shared image" className="max-h-64 rounded-lg object-contain transition-opacity duration-150 group-hover/img:opacity-90" />
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/0 transition-colors duration-150 group-hover/img:bg-black/20">
                <ZoomIn className="size-6 text-white opacity-0 transition-opacity duration-150 group-hover/img:opacity-80" />
              </div>
            </div>
          ) : (
            <LinkifiedText text={message.content} className="whitespace-pre-wrap break-words" highlight={searchHighlight} />
          )}

          {/* Vanish indicator */}
          {message.vanish_mode && (
            <div className="mt-1 flex items-center gap-1 text-[10px] text-white/50"><EyeOff className="size-3" /><span>View once</span></div>
          )}
        </m.div>

        {/* Timestamp + receipt + ephemeral timer */}
        <div className={cn("flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground", isOwn && "flex-row-reverse")}>
          {message.ephemeral_seconds && message.ephemeral_seconds > 0 && (
            <EphemeralTimer seconds={message.ephemeral_seconds} onExpire={() => { /* trigger vanish */ }} />
          )}
          <span className={cn(isNew && "animate-[timestamp-fade_0.4s_ease_0.3s_both]")}>{formatDistanceToNow(new Date(message.created_at || Date.now()), { addSuffix: true })}</span>
          {isOwn && <ReceiptIcon status={message.status} />}
        </div>

        {/* Reactions */}
        {onReact && message.reactions && <ReactionPills reactions={message.reactions} isOwn={isOwn} onReact={(e, a) => onReact(message.id, e, a)} currentUserId={""} />}

        {isFailed && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDeleteMessage?.(message.id); }}
            className="mt-1 flex items-center gap-1 px-1 text-[10px] text-red-400 transition-colors hover:text-red-300"
          >
            <AlertCircle className="size-3" />
            <span>Failed to send &middot; Tap to retry</span>
          </button>
        )}
      </div>

      {isOwn && <div className="w-8 shrink-0" />}
    </m.div>

    {/* Image Lightbox */}
    <AnimatePresence>
      {showLightbox && (
        <ImageLightbox src={showLightbox} onClose={() => setShowLightbox(null)} />
      )}
    </AnimatePresence>
    </>
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
    <div className="flex items-center gap-3 px-4 py-2">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
      <span className="shrink-0 rounded-full bg-background px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm ring-1 ring-border/50">
        {formatDateSeparator(date)}
      </span>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TypingIndicator (smooth wave dots)                                 */
/* ------------------------------------------------------------------ */

function TypingIndicator({ partnerName, partnerAvatar }: { partnerName: string; partnerAvatar: string | null }) {
  const initials = partnerName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div className="flex items-end gap-2.5 px-4">
      <Avatar className="size-8 shrink-0 ring-1 ring-muted">
        {partnerAvatar && <AvatarImage src={partnerAvatar} alt={partnerName} />}
        <AvatarFallback className="bg-gradient-to-br from-violet-100 to-purple-200 text-xs font-medium text-violet-700 dark:from-violet-500 dark:to-purple-600 dark:text-white">{initials}</AvatarFallback>
      </Avatar>
      <m.div
        initial={{ opacity: 0, y: 8, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 4, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="flex items-center gap-2.5 rounded-2xl rounded-bl-md bg-muted px-4 py-3 shadow-sm dark:bg-zinc-800 dark:shadow-violet-950/20"
      >
        <span className="flex gap-1">
          <span className="typing-dot size-[7px] rounded-full bg-violet-400" />
          <span className="typing-dot size-[7px] rounded-full bg-violet-400" />
          <span className="typing-dot size-[7px] rounded-full bg-violet-400" />
        </span>
        <span className="text-xs text-muted-foreground">{partnerName} is typing\u2026</span>
      </m.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton / Empty / NewMsgs                                          */
/* ------------------------------------------------------------------ */

function MessageListSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-4 py-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={cn("flex gap-2.5", i % 2 === 0 ? "justify-start" : "justify-end")}>
          {i % 2 === 0 && <Skeleton className="size-8 shrink-0 rounded-full" />}
          <Skeleton className={cn("h-16 w-48 rounded-2xl", i % 2 !== 0 && "bg-gradient-to-r from-violet-500/20 to-purple-600/20")} />
          {i % 2 !== 0 && <div className="w-8 shrink-0" />}
        </div>
      ))}
    </div>
  );
}

function NewMessagesButton({ onClick, count }: { onClick: () => void; count: number }) {
  return (
    <m.button type="button" onClick={onClick} initial={{ opacity: 0, y: 16, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.9 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 cursor-pointer select-none items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-2 text-xs font-medium text-white shadow-lg shadow-violet-500/20 transition-colors hover:from-violet-600 hover:to-purple-700 active:scale-95" aria-label={`Scroll to ${count} new`} style={{ transform: "translate3d(0,0,0)" }}>
      <ArrowDown className="size-3.5" /><span>{count} new message{count > 1 ? "s" : ""}</span>
    </m.button>
  );
}

function EmptyState({ partnerName, partnerAvatar }: { partnerName: string; partnerAvatar: string | null }) {
  const initials = partnerName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      {/* Decorative large avatar with pulse + glow */}
      <div className="relative">
        {/* Animated glow ring */}
        <div className="absolute -inset-3 rounded-full bg-gradient-to-br from-violet-500/30 to-purple-600/30 blur-lg animate-[pulse_3s_ease-in-out_infinite]" />
        <m.div
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="relative"
        >
          <Avatar className="size-20 ring-4 ring-violet-100 dark:ring-violet-900/50">
            {partnerAvatar && <AvatarImage src={partnerAvatar} alt={partnerName} />}
            <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-2xl font-bold text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
        </m.div>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">{partnerName}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {"👋"} No messages yet. Say hello to start the conversation!
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MessageFeed (main export)                                          */
/* ------------------------------------------------------------------ */

export function MessageFeed({ messages, isLoading, isPartnerTyping, currentUserId, partnerName, partnerAvatar, backgroundStyle, onMarkAsRead, onVanishMessage, onReplyTo, onDeleteMessage, onReact, scrollToMessageId, onScrolledToMessage, searchHighlight, onClearSearchHighlight, loadMore, hasMore, loadingMore }: MessageFeedProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const isAutoScrollRef = useRef(true);
  const [showNewBtn, setShowNewBtn] = useState(false);
  const unreadRef = useRef(0);
  const prevCountRef = useRef(messages.length);
  const prevFirstIdRef = useRef(messages.length > 0 ? messages[0].id : null);
  const prevScrollHeightRef = useRef(0);

  const totalItems = useMemo(() => messages.length + (isPartnerTyping ? 1 : 0), [messages.length, isPartnerTyping]);
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  const virtualizer = useVirtualizer({ count: totalItems, getScrollElement: () => parentRef.current, estimateSize: () => ESTIMATED_ROW_HEIGHT, overscan: OVERSCAN, paddingStart: 16, paddingEnd: 16, gap: 12 });

  const handleScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (dist <= AUTO_SCROLL_THRESHOLD) { isAutoScrollRef.current = true; setShowNewBtn(false); unreadRef.current = 0; }
    else { isAutoScrollRef.current = false; }
    /* Trigger loadMore when scrolled near top */
    if (el.scrollTop < 300 && hasMore && !loadingMore) {
      loadMoreRef.current?.();
    }
  }, [hasMore, loadingMore]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = parentRef.current; if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    isAutoScrollRef.current = true; setShowNewBtn(false); unreadRef.current = 0;
  }, []);

  useEffect(() => { if (messages.length > 0) requestAnimationFrame(() => scrollToBottom("instant")); }, [isLoading, scrollToBottom]);

  useEffect(() => { if (!onMarkAsRead) return; const unread = messages.filter((m) => m.sender_id !== currentUserId && m.status !== "read"); if (unread.length > 0 && isAutoScrollRef.current) onMarkAsRead(unread.map((m) => m.id)); }, [messages, currentUserId, onMarkAsRead]);

  /* ---- Scroll to a specific message ----------------------------------- */
  useEffect(() => {
    if (!scrollToMessageId) return;
    const idx = messages.findIndex((m) => m.id === scrollToMessageId);
    if (idx === -1) { onScrolledToMessage?.(); return; }
    virtualizer.scrollToIndex(idx, { align: "center" });
    onScrolledToMessage?.();
  }, [scrollToMessageId, messages, virtualizer, onScrolledToMessage]);

  /* ---- Handle message count changes (new or prepended) ------------ */
  useEffect(() => {
    const prev = prevCountRef.current;
    const prevFirstId = prevFirstIdRef.current;
    prevCountRef.current = messages.length;
    prevFirstIdRef.current = messages.length > 0 ? messages[0].id : null;

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
    if (own) { requestAnimationFrame(() => scrollToBottom("instant")); return; }
    if (isAutoScrollRef.current) requestAnimationFrame(() => scrollToBottom("smooth"));
    else { unreadRef.current += messages.length - prev; setShowNewBtn(true); }
  }, [messages.length, currentUserId, scrollToBottom]);

  /* Track scroll height for scroll preservation */
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    prevScrollHeightRef.current = el.scrollHeight;
  }, [messages.length]);

  if (isLoading) return <MessageListSkeleton />;
  if (messages.length === 0 && !isPartnerTyping) return <EmptyState partnerName={partnerName} partnerAvatar={partnerAvatar} />;

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div className="relative h-full w-full overflow-hidden" style={backgroundStyle}>
      <div ref={parentRef} onScroll={handleScroll} onClick={() => onClearSearchHighlight?.()} className="h-full w-full overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: "touch" }}>
        <div style={{ height: `${virtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}>
          {/* Loading more spinner */}
          {loadingMore && (
            <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "48px", zIndex: 5 }}>
              <div className="flex items-center justify-center py-3">
                <svg className="size-5 animate-spin text-violet-400" viewBox="0 0 24 24" fill="none" aria-label="Loading more messages">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            </div>
          )}
          {virtualItems.map((vi) => {
            const isTyping = vi.index === messages.length;
            const msg = isTyping ? null : messages[vi.index];
            // Check if we need a date separator before this message
            const showDateSep = msg && vi.index > 0 && messages[vi.index - 1] && (() => {
              const prev = new Date(messages[vi.index - 1].created_at);
              const curr = new Date(msg.created_at);
              return prev.toDateString() !== curr.toDateString();
            })();
            const showFirstDateSep = msg && vi.index === 0;
            return (
              <div key={vi.key} data-index={vi.index} ref={virtualizer.measureElement} style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vi.start}px)` }}>
                {isTyping ? <TypingIndicator partnerName={partnerName} partnerAvatar={partnerAvatar} /> : msg ? (
                  <>
                    {(showDateSep || showFirstDateSep) && <DateSeparator date={msg.created_at} />}
                    <MessageBubble message={msg} isOwn={msg.sender_id === currentUserId} partnerName={partnerName} partnerAvatar={partnerAvatar} onReplyTo={onReplyTo} onReact={onReact} onDeleteMessage={onDeleteMessage} searchHighlight={searchHighlight} />
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      {showNewBtn && unreadRef.current > 0 && <NewMessagesButton count={unreadRef.current} onClick={() => scrollToBottom("smooth")} />}
    </div>
  );
}
