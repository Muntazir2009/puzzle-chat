"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, EyeOff, Eye, Mic, MicOff, X, Clock, Smile, Paperclip, ImageIcon, Link2, Trash2, Ban, ChevronRight, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { MessageFeed } from "@/components/chat/MessageFeed";
import { useChat, type ChatMessage, type SendMessageOptions, type PartnerStatus } from "@/hooks/useChat";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import { cn } from "@/lib/utils";
import { m, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface ChatPartner { id: string; name: string; avatar_url: string | null }
export interface ChatLayoutProps { currentUserId: string; otherUserId: string; conversationId: string; partner: ChatPartner; initialMessages?: ChatMessage[] }

const EPHEMERAL_OPTIONS = [
  { label: "Off", value: null },
  { label: "5s", value: 5 },
  { label: "1m", value: 60 },
  { label: "1h", value: 3600 },
];

const DOT_PATTERN = `url("data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='1' cy='1' r='0.7' fill='%239ca3af' opacity='0.15'/%3E%3C/svg%3E")`;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatLastSeen(lastSeen: string | null): string {
  if (!lastSeen) return "Offline";
  const diffMs = Date.now() - new Date(lastSeen).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "Seen just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Seen ${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `Seen ${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `Seen ${diffDay}d ago`;
  return `Seen ${new Date(lastSeen).toLocaleDateString()}`;
}

function StatusDot({ online, size = "size-2.5" }: { online: boolean; size?: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full",
        size,
        online ? "bg-emerald-500" : "bg-muted-foreground/50",
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  SearchPanel                                                        */
/* ------------------------------------------------------------------ */

function SearchPanel({
  conversationId,
  onResultClick,
  onClose,
}: {
  conversationId: string;
  onResultClick: (messageId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ChatMessage[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /* Auto-focus on open */
  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  /* Escape key to close */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  /* Debounced search */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setIsSearching(false); return; }
    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/messages/search?conversation_id=${conversationId}&q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data: ChatMessage[] = await res.json();
          setResults(data);
        }
      } catch (_err) {
        /* silent */
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, conversationId]);

  return (
    <div
      className="overflow-hidden border-b bg-background/80 backdrop-blur-xl"
    >
      <div className="flex items-center gap-2 px-4 py-2.5">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search messages..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          aria-label="Search messages"
        />
        {isSearching ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <button
            type="button"
            onClick={() => { setQuery(""); onClose(); }}
            className="flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
            aria-label="Close search"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Results list */}
      {results.length > 0 && (
        <div className="max-h-[200px] overflow-y-auto border-t px-2 pb-2">
          {results.map((msg) => (
            <button
              key={msg.id}
              type="button"
              onClick={() => onResultClick(msg.id)}
              className="flex w-full flex-col gap-0.5 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
            >
              <p className="truncate text-sm text-foreground">
                {msg.content.length > 60 ? msg.content.slice(0, 60) + "..." : msg.content}
              </p>
              <span className="text-[11px] text-muted-foreground">
                {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
              </span>
            </button>
          ))}
        </div>
      )}

      {query.trim() && !isSearching && results.length === 0 && (
        <div className="border-t px-4 py-3 text-center text-xs text-muted-foreground">
          No results found
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PartnerInfoPanel                                                   */
/* ------------------------------------------------------------------ */

function PartnerInfoPanel({
  partner,
  partnerStatus,
  open,
  onClose,
}: {
  partner: ChatPartner;
  partnerStatus: PartnerStatus;
  open: boolean;
  onClose: () => void;
}) {
  const [muted, setMuted] = useState(false);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <m.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* Panel */}
          <m.aside
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-sm flex-col bg-background border-l shadow-2xl"
          >
            {/* Panel header */}
            <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
              <h3 className="text-sm font-semibold">User Info</h3>
              <button
                type="button"
                onClick={onClose}
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
                aria-label="Close panel"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
              {/* Avatar + Name + Status */}
              <div className="flex flex-col items-center gap-3 px-6 pt-8 pb-6">
                <div className="relative">
                  <Avatar className="size-20 ring-4 ring-violet-100 dark:ring-violet-900/40">
                    {partner.avatar_url && (
                      <AvatarImage src={partner.avatar_url} alt={partner.name} />
                    )}
                    <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-xl font-bold text-white">
                      {partner.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={cn(
                      "absolute bottom-1 right-1 size-3.5 rounded-full ring-2 ring-background",
                      partnerStatus.online ? "bg-emerald-500" : "bg-muted-foreground/50",
                    )}
                  />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-lg font-semibold">{partner.name}</span>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <StatusDot online={partnerStatus.online} size="size-2" />
                    <span>
                      {partnerStatus.online
                        ? "Online"
                        : formatLastSeen(partnerStatus.last_seen)}
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Shared media (placeholder) */}
              <button
                type="button"
                className="flex w-full items-center justify-between px-5 py-3.5 text-sm text-foreground transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <ImageIcon className="size-4 text-muted-foreground" />
                  <span>Shared media</span>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>

              <Separator />

              {/* Shared links (placeholder) */}
              <button
                type="button"
                className="flex w-full items-center justify-between px-5 py-3.5 text-sm text-foreground transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <Link2 className="size-4 text-muted-foreground" />
                  <span>Shared links</span>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>

              <Separator />

              {/* Mute notifications */}
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-sm">Mute notifications</span>
                <Switch
                  checked={muted}
                  onCheckedChange={setMuted}
                />
              </div>

              <Separator />

              {/* Block user */}
              <button
                type="button"
                className="flex w-full items-center gap-3 px-5 py-3.5 text-sm text-red-500 transition-colors hover:bg-red-500/5"
              >
                <Ban className="size-4" />
                <span>Block user</span>
              </button>

              <Separator />

              {/* Clear chat */}
              <button
                type="button"
                className="flex w-full items-center gap-3 px-5 py-3.5 text-sm text-red-500 transition-colors hover:bg-red-500/5"
              >
                <Trash2 className="size-4" />
                <span>Clear chat</span>
              </button>
            </div>
          </m.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/*  ChatLayout                                                         */
/* ------------------------------------------------------------------ */

export function ChatLayout({ currentUserId, otherUserId, conversationId, partner, initialMessages }: ChatLayoutProps) {
  const { messages, isLoading, isPartnerTyping, partnerStatus, sendMessage, onTyping, markAsRead, vanishMessage, deleteMessage, sendReaction } =
    useChat({ currentUserId, otherUserId, conversationId, initialMessages });

  const [draft, setDraft] = useState("");
  const [sendBtnKey, setSendBtnKey] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [vanishMode, setVanishMode] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [ephemeralOpen, setEphemeralOpen] = useState(false);
  const [ephemeralSeconds, setEphemeralSeconds] = useState<number | null>(null);
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrollToMessageId, setScrollToMessageId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const viewport = useVisualViewport();

  /* Voice */
  const voice = useVoiceRecorder();
  const [showVoiceWaveform, setShowVoiceWaveform] = useState(false);

  const containerStyle = viewport.height > 0 ? ({ height: `${viewport.height}px` } as React.CSSProperties) : ({ height: "100dvh" } as React.CSSProperties);
  const kbOffset = viewport.isKeyboardVisible && viewport.offsetTop > 0 ? ({ marginTop: `-${viewport.offsetTop}px` } as React.CSSProperties) : undefined;

  useEffect(() => { inputRef.current?.focus(); }, []);

  /* Show voice waveform when recording */
  useEffect(() => { setShowVoiceWaveform(voice.isRecording); }, [voice.isRecording]);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || isSending) return;
    setIsSending(true);
    const opts: SendMessageOptions = { vanish_mode: vanishMode, ephemeral_seconds: ephemeralSeconds, reply_to_id: replyTo?.id ?? null };
    setDraft(""); setReplyTo(null);
    if (inputRef.current) inputRef.current.style.height = "auto";
    try { await sendMessage(trimmed, opts); setSendBtnKey((k) => k + 1); }
    finally { setIsSending(false); requestAnimationFrame(() => inputRef.current?.focus()); }
  }, [draft, isSending, sendMessage, vanishMode, ephemeralSeconds, replyTo]);

  const handleVoiceSend = useCallback(async () => {
    const result = await voice.stopRecording();
    if (!result || result.duration < 1) return;
    const blob = result.blob;
    const url = URL.createObjectURL(blob);
    await sendMessage(url, { type: "voice", voice_duration: result.duration, waveform_data: result.amplitudes, ephemeral_seconds: ephemeralSeconds });
    URL.revokeObjectURL(url);
  }, [voice, sendMessage, ephemeralSeconds]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); const form = e.currentTarget.closest("form"); if (form) form.requestSubmit(); }
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => { setDraft(e.target.value); onTyping(); }, [onTyping]);
  const handleInput = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 128)}px`; }, []);

  const hasText = draft.trim().length > 0;

  /* Search result click → scroll to message */
  const handleSearchResultClick = useCallback((messageId: string) => {
    setScrollToMessageId(messageId);
    setSearchOpen(false);
  }, []);

  const handleScrolledToMessage = useCallback(() => {
    setScrollToMessageId(null);
  }, []);

  /* Status text for header */
  const statusText = isPartnerTyping
    ? "typing\u2026"
    : partnerStatus.online
      ? "Online"
      : formatLastSeen(partnerStatus.last_seen);

  /* ---- Render --------------------------------------------------- */

  return (
    <div className="flex w-full flex-col bg-background" style={containerStyle}>
      <div style={kbOffset} className="flex min-h-0 flex-1 flex-col">
        {/* Header - sticky with glassmorphic blur + shadow */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border/40 bg-background/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] backdrop-blur-2xl supports-[backdrop-filter]:bg-background/60 px-4">
          <button
            type="button"
            onClick={() => setInfoPanelOpen(true)}
            className="flex items-center gap-3 rounded-lg p-1 -ml-1 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50"
            aria-label="Open user info"
          >
            <Avatar className="size-9 ring-2 ring-violet-100 dark:ring-violet-900/50">
              {partner.avatar_url && <AvatarImage src={partner.avatar_url} alt={partner.name} />}
              <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-xs font-semibold text-white">{partner.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-semibold leading-tight">{partner.name}</span>
              <div className="flex items-center gap-1.5">
                <StatusDot online={partnerStatus.online} />
                <span className={cn(
                  "text-xs",
                  isPartnerTyping ? "text-violet-500" : "text-muted-foreground",
                )}>{statusText}</span>
              </div>
            </div>
          </button>

          {/* Search icon button - right side of header */}
          <div className="ml-auto">
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              className={cn(
                "flex size-9 items-center justify-center rounded-lg transition-colors",
                searchOpen
                  ? "bg-violet-500/15 text-violet-500"
                  : "text-muted-foreground hover:bg-muted",
              )}
              aria-label={searchOpen ? "Close search" : "Search messages"}
            >
              <Search className="size-4" />
            </button>
          </div>
        </header>

        {/* Search panel (animated slide-down) */}
        <AnimatePresence>
          {searchOpen && (
            <SearchPanel
              conversationId={conversationId}
              onResultClick={handleSearchResultClick}
              onClose={() => setSearchOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* Feed with dot pattern background */}
        <div className="relative min-h-0 flex-1">
          {/* Subtle dot pattern behind messages */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: DOT_PATTERN,
              backgroundRepeat: "repeat",
              backgroundSize: "20px 20px",
            }}
            aria-hidden="true"
          />
          <MessageFeed
            messages={messages}
            isLoading={isLoading}
            isPartnerTyping={isPartnerTyping}
            currentUserId={currentUserId}
            partnerName={partner.name}
            partnerAvatar={partner.avatar_url}
            onMarkAsRead={markAsRead}
            onVanishMessage={vanishMessage}
            onDeleteMessage={deleteMessage}
            onReplyTo={setReplyTo}
            onReact={sendReaction}
            scrollToMessageId={scrollToMessageId}
            onScrolledToMessage={handleScrolledToMessage}
          />
        </div>

        {/* Reply preview bar */}
        <AnimatePresence>
          {replyTo && (
            <m.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden border-t bg-muted/30">
              <div className="flex items-center gap-2 px-4 py-2">
                <div className="w-1 h-8 rounded-full bg-gradient-to-b from-violet-500 to-purple-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-violet-500">{replyTo.sender_name || "Unknown"}</p>
                  <p className="truncate text-xs text-muted-foreground">{replyTo.content}</p>
                </div>
                <button type="button" onClick={() => setReplyTo(null)} className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"><X className="size-3.5" /></button>
              </div>
            </m.div>
          )}
        </AnimatePresence>

        {/* Voice waveform overlay */}
        <AnimatePresence>
          {showVoiceWaveform && (
            <m.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-red-500/15 text-red-500">
                  {voice.isRecording ? <span className="relative flex size-3"><span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex size-3 rounded-full bg-red-500" /></span> : null}
                </div>
                <div className="flex flex-1 items-end justify-center gap-px" style={{ height: 40 }}>
                  {voice.amplitudes.slice(-60).map((amp, i) => (
                    <div key={i} className="w-[2px] rounded-full bg-violet-500/70 transition-all duration-75" style={{ height: `${Math.max(3, amp * 40)}px` }} />
                  ))}
                </div>
                <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">{Math.floor(voice.duration / 60)}:{String(voice.duration % 60).padStart(2, "0")}</span>
                <m.button type="button" onClick={handleVoiceSend} whileTap={{ scale: 0.9 }} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-purple-600 text-white" aria-label="Send voice">
                  <ArrowUp className="size-4" />
                </m.button>
              </div>
            </m.div>
          )}
        </AnimatePresence>

        {/* Input bar */}
        <div className="shrink-0 border-t bg-background px-3 py-2.5 sm:px-4 sm:py-3">
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            {/* Vanish toggle - compact with smooth transition */}
            <m.button type="button" onClick={() => setVanishMode((v) => !v)} whileTap={{ scale: 0.9 }} className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200", vanishMode ? "bg-violet-500/15 text-violet-500 shadow-sm shadow-violet-500/10" : "text-muted-foreground hover:bg-muted")} aria-label="Vanish mode">
              {vanishMode ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </m.button>

            {/* Ephemeral timer dropdown - compact */}
            <div className="relative">
              <m.button type="button" onClick={() => setEphemeralOpen((v) => !v)} whileTap={{ scale: 0.9 }} className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-200", ephemeralSeconds ? "bg-amber-500/15 text-amber-500" : "text-muted-foreground hover:bg-muted")} aria-label="Ephemeral timer">
                <Clock className="size-3.5" />
              </m.button>
              <AnimatePresence>
                {ephemeralOpen && (
                  <m.div initial={{ opacity: 0, y: 4, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4, scale: 0.95 }} transition={{ duration: 0.15 }} className="absolute bottom-full left-0 z-50 mb-2 w-32 overflow-hidden rounded-xl border bg-popover p-1.5 shadow-xl shadow-black/10">
                    {EPHEMERAL_OPTIONS.map((opt) => (
                      <button key={opt.label} type="button" onClick={() => { setEphemeralSeconds(opt.value); setEphemeralOpen(false); }}
                        className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs transition-all duration-150", ephemeralSeconds === opt.value ? "bg-violet-500/10 text-violet-500 font-semibold" : "text-foreground hover:bg-muted")}>
                        <Clock className="size-3 opacity-60" />{opt.label}
                      </button>
                    ))}
                  </m.div>
                )}
              </AnimatePresence>
            </div>

            {/* Text input (hidden when recording) - pill shaped with gradient border on focus */}
            {!showVoiceWaveform && (
              <div className="relative flex-1">
                <textarea ref={inputRef} value={draft} onChange={handleInputChange} onKeyDown={handleKeyDown} onInput={handleInput}
                  placeholder={vanishMode ? "Send a disappearing message\u2026" : replyTo ? `Reply to ${replyTo.sender_name || "message"}...` : "Type a message\u2026"}
                  rows={1} className={cn(
                    "w-full resize-none rounded-2xl border bg-muted/50 px-4 py-3 text-sm",
                    "placeholder:text-muted-foreground",
                    "focus-visible:outline-none",
                    "max-h-32 overflow-y-auto",
                    "transition-all duration-300",
                    // Glow effect on focus
                    "focus-visible:border-transparent focus-visible:ring-2",
                    vanishMode
                      ? "border-violet-500/30 focus-visible:ring-violet-400/40 focus-visible:shadow-[0_0_12px_rgba(139,92,246,0.15)]"
                      : "focus-visible:ring-violet-400/30 focus-visible:shadow-[0_0_12px_rgba(139,92,246,0.08)]",
                  )}
                />
              </div>
            )}

            {/* Attachment button (placeholder) */}
            {!showVoiceWaveform && (
              <m.button type="button" whileTap={{ scale: 0.9 }} className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted" aria-label="Attach file">
                <Paperclip className="size-4" />
              </m.button>
            )}

            {/* Emoji button (placeholder) */}
            {!showVoiceWaveform && (
              <m.button type="button" whileTap={{ scale: 0.9 }} className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted" aria-label="Emoji">
                <Smile className="size-4" />
              </m.button>
            )}

            {/* Send button (shown when there's text) */}
            {!showVoiceWaveform && hasText && (
              <AnimatePresence>
                <m.div key={sendBtnKey} initial={{ scale: 0, opacity: 0, rotate: -90 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 0, opacity: 0 }} transition={{ duration: 0.2, type: "spring", stiffness: 500, damping: 25 }}>
                  <Button type="submit" size="icon" disabled={isSending}
                    className={cn("size-9 shrink-0 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 shadow-md shadow-violet-500/25 transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/30 hover:scale-105")}
                    aria-label="Send message"><ArrowUp className="size-4" /></Button>
                </m.div>
              </AnimatePresence>
            )}

            {/* Mic button (shown when input is empty) */}
            {!showVoiceWaveform && !hasText && (
              <AnimatePresence>
                <m.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={{ duration: 0.15, type: "spring", stiffness: 500, damping: 30 }}>
                  <m.button type="button" onClick={() => voice.startRecording()} whileTap={{ scale: 0.9 }} className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted" aria-label="Record voice">
                    <Mic className="size-4" />
                  </m.button>
                </m.div>
              </AnimatePresence>
            )}

            {/* Cancel recording button */}
            {showVoiceWaveform && (
              <m.button type="button" onClick={async () => { await voice.stopRecording(); setShowVoiceWaveform(false); }} whileTap={{ scale: 0.9 }} className="flex size-10 shrink-0 items-center justify-center rounded-xl text-red-500 hover:bg-red-500/10" aria-label="Cancel recording">
                <MicOff className="size-4" />
              </m.button>
            )}
          </form>
        </div>
      </div>

      {/* Partner Info Panel */}
      <PartnerInfoPanel
        partner={partner}
        partnerStatus={partnerStatus}
        open={infoPanelOpen}
        onClose={() => setInfoPanelOpen(false)}
      />
    </div>
  );
}
