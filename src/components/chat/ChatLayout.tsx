"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, EyeOff, Eye, Mic, MicOff, X, Clock, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageFeed } from "@/components/chat/MessageFeed";
import { useChat, type ChatMessage, type SendMessageOptions } from "@/hooks/useChat";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import { cn } from "@/lib/utils";
import { m, AnimatePresence } from "framer-motion";

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

/* ------------------------------------------------------------------ */
/*  ChatLayout                                                         */
/* ------------------------------------------------------------------ */

export function ChatLayout({ currentUserId, otherUserId, conversationId, partner, initialMessages }: ChatLayoutProps) {
  const { messages, isLoading, isPartnerTyping, sendMessage, onTyping, markAsRead, vanishMessage, sendReaction } =
    useChat({ currentUserId, otherUserId, conversationId, initialMessages });

  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [vanishMode, setVanishMode] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [ephemeralOpen, setEphemeralOpen] = useState(false);
  const [ephemeralSeconds, setEphemeralSeconds] = useState<number | null>(null);
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
    try { await sendMessage(trimmed, opts); }
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

  /* ---- Render --------------------------------------------------- */

  return (
    <div className="flex w-full flex-col bg-background" style={containerStyle}>
      <div style={kbOffset} className="flex min-h-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
          <Avatar className="size-9">
            {partner.avatar_url && <AvatarImage src={partner.avatar_url} alt={partner.name} />}
            <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-semibold text-white">{partner.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-tight">{partner.name}</span>
            <span className={cn("text-xs", isPartnerTyping ? "text-indigo-500" : "text-muted-foreground")}>{isPartnerTyping ? "typing\u2026" : "Online"}</span>
          </div>
        </header>

        {/* Feed */}
        <div className="min-h-0 flex-1">
          <MessageFeed messages={messages} isLoading={isLoading} isPartnerTyping={isPartnerTyping} currentUserId={currentUserId} partnerName={partner.name} partnerAvatar={partner.avatar_url} onMarkAsRead={markAsRead} onVanishMessage={vanishMessage} onReplyTo={setReplyTo} onReact={sendReaction} />
        </div>

        {/* Reply preview bar */}
        <AnimatePresence>
          {replyTo && (
            <m.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden border-t bg-muted/30">
              <div className="flex items-center gap-2 px-4 py-2">
                <div className="w-1 h-8 rounded-full bg-gradient-to-b from-indigo-500 to-purple-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-indigo-500">{replyTo.sender_name || "Unknown"}</p>
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
                    <div key={i} className="w-[2px] rounded-full bg-indigo-500/70 transition-all duration-75" style={{ height: `${Math.max(3, amp * 40)}px` }} />
                  ))}
                </div>
                <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">{Math.floor(voice.duration / 60)}:{String(voice.duration % 60).padStart(2, "0")}</span>
                <m.button type="button" onClick={handleVoiceSend} whileTap={{ scale: 0.9 }} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white" aria-label="Send voice">
                  <ArrowUp className="size-4" />
                </m.button>
              </div>
            </m.div>
          )}
        </AnimatePresence>

        {/* Input bar */}
        <div className="shrink-0 border-t bg-background px-3 py-2.5 sm:px-4 sm:py-3">
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            {/* Vanish toggle */}
            <m.button type="button" onClick={() => setVanishMode((v) => !v)} whileTap={{ scale: 0.9 }} className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-200", vanishMode ? "bg-indigo-500/15 text-indigo-500" : "text-muted-foreground hover:bg-muted")} aria-label="Vanish mode">
              {vanishMode ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </m.button>

            {/* Ephemeral timer dropdown */}
            <div className="relative">
              <m.button type="button" onClick={() => setEphemeralOpen((v) => !v)} whileTap={{ scale: 0.9 }} className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-200", ephemeralSeconds ? "bg-amber-500/15 text-amber-500" : "text-muted-foreground hover:bg-muted")} aria-label="Ephemeral timer">
                <Clock className="size-4" />
              </m.button>
              <AnimatePresence>
                {ephemeralOpen && (
                  <m.div initial={{ opacity: 0, y: 4, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4, scale: 0.95 }} transition={{ duration: 0.15 }} className="absolute bottom-full left-0 z-50 mb-2 w-28 overflow-hidden rounded-xl border bg-popover p-1 shadow-xl">
                    {EPHEMERAL_OPTIONS.map((opt) => (
                      <button key={opt.label} type="button" onClick={() => { setEphemeralSeconds(opt.value); setEphemeralOpen(false); }}
                        className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors", ephemeralSeconds === opt.value ? "bg-indigo-500/10 text-indigo-500 font-medium" : "text-foreground hover:bg-muted")}>
                        <Clock className="size-3" />{opt.label}
                      </button>
                    ))}
                  </m.div>
                )}
              </AnimatePresence>
            </div>

            {/* Text input (hidden when recording) */}
            {!showVoiceWaveform && (
              <textarea ref={inputRef} value={draft} onChange={handleInputChange} onKeyDown={handleKeyDown} onInput={handleInput}
                placeholder={vanishMode ? "Send a disappearing message\u2026" : replyTo ? `Reply to ${replyTo.sender_name || "message"}...` : "Type a message\u2026"}
                rows={1} className={cn("flex-1 resize-none rounded-xl border bg-muted/50 px-3 py-2.5 text-sm sm:px-4", "placeholder:text-muted-foreground", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40", "max-h-32 overflow-y-auto", "transition-[box-shadow] duration-150", vanishMode && "border-indigo-500/30 focus-visible:ring-indigo-500/40")}
              />
            )}

            {/* Mic / Send */}
            {!showVoiceWaveform ? (
              <Button type="submit" size="icon" disabled={!draft.trim() || isSending}
                className={cn("size-10 shrink-0 rounded-xl", (vanishMode || ephemeralSeconds) && "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700")}
                aria-label="Send message"><ArrowUp className="size-4" /></Button>
            ) : null}

            {/* Mic button (shown when not recording, hidden during) */}
            {!showVoiceWaveform && (
              <m.button type="button" onClick={() => voice.startRecording()} whileTap={{ scale: 0.9 }} className="flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted" aria-label="Record voice">
                <Mic className="size-4" />
              </m.button>
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
    </div>
  );
}