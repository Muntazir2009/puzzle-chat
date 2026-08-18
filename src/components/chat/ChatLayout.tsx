"use client";

import { type ChangeEvent, type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Mic, MicOff, X, Smile, Paperclip, ImageIcon, Link2, Trash2, Ban, Bell, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageFeed } from "@/components/chat/MessageFeed";
import { EmojiPicker } from "@/components/chat/EmojiPicker";
import { ChatBackgroundPicker, useChatBackground } from "@/components/chat/ChatBackgroundPicker";
import { useChat, type ChatMessage, type SendMessageOptions, type PartnerStatus } from "@/hooks/useChat";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import { cn } from "@/lib/utils";
import { m, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface ChatPartner { id: string; name: string; avatar_url: string | null }
export interface ChatLayoutProps { currentUserId: string; currentUserName: string; currentUserAvatar: string | null; otherUserId: string; conversationId: string; partner: ChatPartner; initialMessages?: ChatMessage[] }

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_TYPES = "image/*,video/mp4,.pdf,.txt";
const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
  const statusText = partnerStatus.online
    ? "Online"
    : formatLastSeen(partnerStatus.last_seen);

  return (
    <AnimatePresence>
      {open && (
        <>
          <m.div
            key="info-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <m.div
            key="info-pill"
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed top-16 left-1/2 z-50 -translate-x-1/2 w-[90%] max-w-md rounded-2xl bg-neutral-900/90 border border-white/10 shadow-2xl backdrop-blur-xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Partner avatar + name + status */}
            <div className="flex items-center gap-3 mb-3">
              <Avatar className="size-12 ring-2 ring-white/10">
                {partner.avatar_url && <AvatarImage src={partner.avatar_url} alt={partner.name} />}
                <AvatarFallback
                  className="text-sm font-bold text-white"
                  style={{ background: "linear-gradient(to bottom right, var(--app-accent-from), var(--app-accent-to))" }}
                >{partner.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold">{partner.name}</p>
                <div className="flex items-center gap-1.5">
                  <StatusDot online={partnerStatus.online} />
                  <span className="text-xs text-white/50">{statusText}</span>
                </div>
              </div>
            </div>
            {/* Action buttons in a row */}
            <div className="flex items-center gap-2">
              <button className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white/5 py-2 text-xs text-white/70 hover:bg-white/10">
                <ImageIcon className="size-3.5" /> Shared media
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white/5 py-2 text-xs text-white/70 hover:bg-white/10">
                <Link2 className="size-3.5" /> Shared links
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white/5 py-2 text-xs text-white/70 hover:bg-white/10">
                <Bell className="size-3.5" /> Mute
              </button>
            </div>
            {/* Destructive actions */}
            <div className="flex items-center gap-2 mt-2">
              <button className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2 text-xs text-red-400 hover:bg-red-500/10">
                <Ban className="size-3.5" /> Block
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2 text-xs text-red-400 hover:bg-red-500/10">
                <Trash2 className="size-3.5" /> Clear chat
              </button>
            </div>
          </m.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/*  ChatLayout                                                         */
/* ------------------------------------------------------------------ */

export function ChatLayout({ currentUserId, currentUserName, currentUserAvatar, otherUserId, conversationId, partner, initialMessages }: ChatLayoutProps) {
  const { messages, isLoading, isPartnerTyping, partnerStatus, sendMessage, onTyping, markAsRead, vanishMessage, deleteMessage, sendReaction, loadMore, hasMore, loadingMore } =
    useChat({ currentUserId, otherUserId, conversationId, initialMessages });

  const [draft, setDraft] = useState("");
  const [sendBtnKey, setSendBtnKey] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [vanishMode] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [ephemeralSeconds] = useState<number | null>(null);
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const viewport = useVisualViewport();

  /* Background theme + wallpaper */
  const { themeId, theme, selectTheme, wallpaper, setWallpaper } = useChatBackground();

  /* Voice */
  const voice = useVoiceRecorder();
  const [showVoiceWaveform, setShowVoiceWaveform] = useState(false);
  const [isSendingVoice, setIsSendingVoice] = useState(false);

  /* Attachment */
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const containerStyle = viewport.height > 0 ? ({ height: `${viewport.height}px` } as React.CSSProperties) : ({ height: "100dvh" } as React.CSSProperties);
  const kbOffset = viewport.isKeyboardVisible && viewport.offsetTop > 0 ? ({ marginTop: `-${viewport.offsetTop}px` } as React.CSSProperties) : undefined;

  /* Compute background style — wallpaper overrides theme */
  const bgStyle = wallpaper
    ? wallpaper.startsWith('url(') || wallpaper.startsWith('http')
      ? {
          backgroundImage: `url(${wallpaper})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }
      : {
          background: wallpaper,
        }
    : theme.style;

  // Don't auto-focus input on chat open — let user tap when ready

  /* Show voice waveform when recording */
  useEffect(() => { setShowVoiceWaveform(voice.isRecording); }, [voice.isRecording]);

  /* Global keyboard shortcuts */
  useEffect(() => {
    function handleGlobalKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (replyTo) { setReplyTo(null); e.preventDefault(); }
        else if (infoPanelOpen) { setInfoPanelOpen(false); e.preventDefault(); }
      }
    }
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, [replyTo, infoPanelOpen]);

  /* Derived values — MUST be declared before any useCallback that
     references them in its dependency array to avoid TDZ errors
     in the production webpack bundle. */
  const hasAttachment = attachmentFile !== null;
  const hasText = draft.trim().length > 0;

  /* ---- Attachment upload helpers (declared BEFORE handleSubmit
     because handleSubmit's dependency array includes uploadAttachment;
     accessing a const before its declaration causes a TDZ crash in the
     production webpack bundle deployed to Cloudflare Workers). ---- */
  const clearAttachment = useCallback(() => {
    if (attachmentPreview) URL.revokeObjectURL(attachmentPreview);
    setAttachmentFile(null);
    setAttachmentPreview(null);
  }, [attachmentPreview]);

  const uploadAttachment = useCallback(async () => {
    if (!attachmentFile || isUploading) return;
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", attachmentFile);
      fd.append("conversation_id", conversationId);
      if (replyTo?.id) fd.append("reply_to_id", replyTo.id);
      if (vanishMode) fd.append("vanish_mode", "true");
      if (ephemeralSeconds) fd.append("ephemeral_seconds", String(ephemeralSeconds));

      const res = await fetch("/api/messages/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(data.error || `Upload failed: ${res.status}`);
      }
      /* Message is inserted server-side and pushed via realtime;
         the useChat hook will pick it up automatically. */
      clearAttachment();
      setReplyTo(null);
    } catch (err) {
      console.error("[ChatLayout] upload error:", err);
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Could not send the file.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }, [attachmentFile, isUploading, conversationId, replyTo, vanishMode, ephemeralSeconds, clearAttachment]);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    /* If an attachment is selected, upload it instead of sending text */
    if (hasAttachment && !hasText) {
      await uploadAttachment();
      return;
    }
    /* If there's both text and an attachment, send text first, then upload */
    const trimmed = draft.trim();
    if (!trimmed || isSending) return;
    setIsSending(true);
    const opts: SendMessageOptions = { vanish_mode: vanishMode, ephemeral_seconds: ephemeralSeconds, reply_to_id: replyTo?.id ?? null };
    setDraft(""); setReplyTo(null);
    if (inputRef.current) inputRef.current.style.height = "auto";
    try {
      await sendMessage(trimmed, opts);
      setSendBtnKey((k) => k + 1);
      /* Upload attachment after text is sent */
      if (hasAttachment) await uploadAttachment();
    }
    finally { setIsSending(false); requestAnimationFrame(() => inputRef.current?.focus()); }
  }, [draft, isSending, sendMessage, vanishMode, ephemeralSeconds, replyTo, hasAttachment, uploadAttachment]);

  const handleVoiceSend = useCallback(async () => {
    const result = await voice.stopRecording();
    if (!result || result.duration < 1) return;
    const blob = result.blob;
    setIsSendingVoice(true);
    try {
      const fd = new FormData();
      fd.append("file", blob, "voice-note.webm");
      fd.append("conversation_id", conversationId);
      fd.append("voice_duration", String(result.duration));
      fd.append("waveform_data", JSON.stringify(result.amplitudes));
      if (ephemeralSeconds) fd.append("ephemeral_seconds", String(ephemeralSeconds));

      const res = await fetch("/api/messages/voice", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Voice upload failed" }));
        throw new Error(data.error || `Voice upload failed: ${res.status}`);
      }
      /* Message is created server-side and broadcast via realtime. */
    } catch (err) {
      console.error("[ChatLayout] voice upload error:", err);
      toast({
        title: "Voice note failed",
        description: err instanceof Error ? err.message : "Could not send the voice note.",
        variant: "destructive",
      });
    } finally {
      setIsSendingVoice(false);
    }
  }, [voice, conversationId, ephemeralSeconds]);

  const handleVoiceCancel = useCallback(async () => {
    await voice.stopRecording();
    /* showVoiceWaveform is set to false by the useEffect watching voice.isRecording */
  }, [voice]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); const form = e.currentTarget.closest("form"); if (form) form.requestSubmit(); }
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => { setDraft(e.target.value); onTyping(); }, [onTyping]);
  const handleInput = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 128)}px`; }, []);

  const canSend = hasText || hasAttachment;

  /* ---- Attachment handlers ---------------------------------------- */
  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_SIZE) {
      toast({ title: "File too large", description: "Maximum size is 10 MB.", variant: "destructive" });
      e.target.value = "";
      return;
    }
    setAttachmentFile(file);
    /* Generate thumbnail preview for images */
    if (IMAGE_MIME_TYPES.has(file.type)) {
      const url = URL.createObjectURL(file);
      setAttachmentPreview(url);
    } else {
      setAttachmentPreview(null);
    }
    /* Reset input so the same file can be re-selected */
    e.target.value = "";
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const handlePaperclipClick = useCallback(() => {
    fileInputRef.current?.click();
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
        {/* Header — glassmorphic, minimal, no shadow/glow */}
        <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-3 px-4 border-b border-white/5 bg-white/[0.06] backdrop-blur-2xl">
          <button
            type="button"
            onClick={() => setInfoPanelOpen(true)}
            className="flex items-center gap-3 rounded-lg p-1 -ml-1 transition-colors hover:bg-white/5 focus-visible:outline-none"
            aria-label="Open user info"
          >
            <Avatar className="size-8 ring-2 ring-[var(--app-accent-lighter)]/30">
              {partner.avatar_url && <AvatarImage src={partner.avatar_url} alt={partner.name} />}
              <AvatarFallback
                className="text-[10px] font-semibold text-white"
                style={{ background: "linear-gradient(to bottom right, var(--app-accent-from), var(--app-accent-to))" }}
              >{partner.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-semibold leading-tight text-white">{partner.name}</span>
              <div className="flex items-center gap-1.5">
                <StatusDot online={partnerStatus.online} />
                <span
                  className={cn("text-[11px]", isPartnerTyping ? "font-medium" : "text-white/40")}
                  style={isPartnerTyping ? { color: "var(--app-accent)" } : undefined}
                >{statusText}</span>
              </div>
            </div>
          </button>

          {/* Right-side header actions */}
          <div className="ml-auto flex items-center gap-1">
            <ChatBackgroundPicker themeId={themeId} onSelect={selectTheme} wallpaper={wallpaper} onSetWallpaper={setWallpaper} />
          </div>
        </header>

        {/* Feed area — pb-24 so messages never get covered by the floating input pill */}
        <div className="relative min-h-0 flex-1 pb-24">
          <MessageFeed
            messages={messages}
            isLoading={isLoading}
            isPartnerTyping={isPartnerTyping}
            currentUserId={currentUserId}
            partnerName={partner.name}
            partnerAvatar={partner.avatar_url}
            backgroundStyle={bgStyle}
            currentUserName={currentUserName}
            currentUserAvatar={currentUserAvatar}
            onMarkAsRead={markAsRead}
            onVanishMessage={vanishMessage}
            onDeleteMessage={deleteMessage}
            onReplyTo={setReplyTo}
            onReact={sendReaction}
            loadMore={loadMore}
            hasMore={hasMore}
            loadingMore={loadingMore}
          />
        </div>
      </div>

      {/* Hidden file input for attachments */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={handleFileSelect}
        className="hidden"
        aria-hidden="true"
      />

      {/* Floating preview bars above the pill */}
      {(replyTo || attachmentFile) && (
        <div
          className="fixed left-1/2 -translate-x-1/2 w-[90%] max-w-lg z-30 flex flex-col gap-1.5"
          style={{ bottom: 72 }}
        >
          {/* Attachment preview bar */}
          <AnimatePresence>
            {attachmentFile && (
              <m.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="overflow-hidden rounded-2xl border backdrop-blur-sm"
                style={{ backgroundColor: "var(--app-accent-subtle)", borderColor: "var(--app-accent-subtle)" }}
              >
                <div className="flex items-center gap-3 px-4 py-2.5">
                  {attachmentPreview ? (
                    <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-white/10">
                      <img src={attachmentPreview} alt={attachmentFile.name} className="size-full object-cover" />
                    </div>
                  ) : (
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: "var(--app-accent-subtle)", color: "var(--app-accent)" }}>
                      {attachmentFile.type === "application/pdf" ? (
                        <FileText className="size-5" />
                      ) : attachmentFile.type.startsWith("video/") ? (
                        <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                      ) : (
                        <FileText className="size-5" />
                      )}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{attachmentFile.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(attachmentFile.size)}</p>
                  </div>
                  {isUploading ? (
                    <Loader2 className="size-5 shrink-0 animate-spin" style={{ color: "var(--app-accent)" }} />
                  ) : (
                    <button
                      type="button"
                      onClick={clearAttachment}
                      className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
                      aria-label="Remove attachment"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              </m.div>
            )}
          </AnimatePresence>

          {/* Reply preview bar */}
          <AnimatePresence>
            {replyTo && (
              <m.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="overflow-hidden backdrop-blur-sm rounded-2xl"
                style={{ backgroundColor: "var(--app-accent-subtle)", borderLeft: "2px solid var(--app-accent)" }}
              >
                <div className="flex items-center gap-2 px-4 py-2">
                  <div className="w-1 h-8 rounded-full" style={{ background: "linear-gradient(to bottom, var(--app-accent-from), var(--app-accent-to))" }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold" style={{ color: "var(--app-accent)" }}>{replyTo.sender_name || "Unknown"}</p>
                    <p className="truncate text-xs text-muted-foreground">{replyTo.content}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setReplyTo(null)}
                      className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted active:scale-95"
                    >
                      <X className="size-3.5" />
                    </button>
                    <kbd className="hidden sm:inline-flex h-5 items-center rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">Esc</kbd>
                  </div>
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Compact floating input pill */}
      <form onSubmit={handleSubmit}>
        <div
          className={cn(
            "fixed bottom-4 left-1/2 -translate-x-1/2",
            "w-[90%] max-w-lg",
            "rounded-full",
            "backdrop-blur-2xl bg-white/[0.08]",
            "border border-white/[0.12]",
            "p-1.5 px-3 shadow-2xl z-40",
            "flex items-center gap-2",
            "transition-all duration-200",
            "focus-within:border-white/25 focus-within:bg-white/[0.12]",
          )}
        >
          {/* Paperclip button — left side of pill */}
          {!showVoiceWaveform && (
            <button
              type="button"
              onClick={handlePaperclipClick}
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full transition-colors duration-200 active:scale-95",
                hasAttachment ? "text-[var(--app-accent)]" : "text-white/50 hover:text-white/80",
              )}
              aria-label="Attach file"
            >
              <Paperclip className="size-4" />
            </button>
          )}

          {/* Emoji button — left side of pill, next to paperclip */}
          {!showVoiceWaveform && (
            <EmojiPicker
              onSelect={(emoji) => {
                const ta = inputRef.current;
                if (!ta) return;
                const start = ta.selectionStart ?? draft.length;
                const end = ta.selectionEnd ?? draft.length;
                const before = draft.slice(0, start);
                const after = draft.slice(end);
                setDraft(before + emoji + after);
                requestAnimationFrame(() => {
                  const pos = start + emoji.length;
                  ta.focus();
                  ta.setSelectionRange(pos, pos);
                });
              }}
            >
              <button
                type="button"
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-white/50 transition-colors duration-200 hover:text-white/80 active:scale-95"
                aria-label="Emoji"
              >
                <Smile className="size-4" />
              </button>
            </EmojiPicker>
          )}

          {/* Textarea — middle of pill (hidden when recording) */}
          {!showVoiceWaveform && (
            <textarea
              ref={inputRef}
              value={draft}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onInput={handleInput}
              placeholder={replyTo ? `Reply to ${replyTo.sender_name || "message"}...` : "Type a message..."}
              rows={1}
              className={cn(
                "flex-1 resize-none bg-transparent py-2 px-1 text-sm",
                "text-white placeholder:text-white/40",
                "focus-visible:outline-none",
                "max-h-32 overflow-y-auto",
                "scrollbar-none",
              )}
            />
          )}

          {/* Voice waveform overlay — replaces textarea inside the pill */}
          {showVoiceWaveform && (
            <div className="flex flex-1 items-center gap-3 px-3 py-1.5">
              {/* Red recording dot */}
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-500">
                {voice.isRecording && (
                  <span className="relative flex size-3">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex size-3 rounded-full bg-red-500" />
                  </span>
                )}
              </div>

              {/* Waveform bars */}
              <div className="flex flex-1 items-end justify-center gap-px" style={{ height: 32 }}>
                {voice.amplitudes.slice(-40).map((amp, i) => (
                  <div
                    key={i}
                    className="w-[2px] rounded-full transition-all duration-75"
                    style={{
                      height: `${Math.max(3, amp * 32)}px`,
                      backgroundColor: "var(--app-accent)",
                      opacity: 0.7,
                    }}
                  />
                ))}
              </div>

              {/* Timer */}
              <span className="shrink-0 text-xs font-medium tabular-nums text-white/50">
                {Math.floor(voice.duration / 60)}:{String(voice.duration % 60).padStart(2, "0")}
              </span>
            </div>
          )}

          {/* Right side of pill: Send / Mic / Voice controls */}

          {/* Cancel recording button */}
          {showVoiceWaveform && (
            <button
              type="button"
              onClick={handleVoiceCancel}
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-red-500 transition-colors hover:bg-red-500/10 active:scale-95"
              aria-label="Cancel recording"
            >
              <MicOff className="size-4" />
            </button>
          )}

          {/* Voice send button */}
          {showVoiceWaveform && (
            <button
              type="button"
              onClick={handleVoiceSend}
              disabled={isSendingVoice}
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-white transition-opacity active:scale-95 disabled:opacity-50"
              style={{ background: "linear-gradient(to right, var(--app-accent-from), var(--app-accent-to))" }}
              aria-label="Send voice"
            >
              {isSendingVoice ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
            </button>
          )}

          {/* Send button (shown when there's text or attachment) */}
          {!showVoiceWaveform && canSend && (
            <AnimatePresence>
              <m.div
                key={sendBtnKey}
                initial={{ scale: 0, opacity: 0, rotate: -90 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
              >
                <Button
                  type="submit"
                  size="icon"
                  disabled={isSending || isUploading}
                  className="size-8 shrink-0 rounded-full text-white transition-all duration-200 hover:opacity-80 hover:scale-105 active:scale-95"
                  style={{
                    background: "linear-gradient(to right, var(--app-accent-from), var(--app-accent-to))",
                  }}
                  aria-label="Send message"
                >
                  <ArrowUp className="size-3.5" />
                </Button>
              </m.div>
            </AnimatePresence>
          )}

          {/* Mic button (shown when input is empty and no attachment) */}
          {!showVoiceWaveform && !canSend && (
            <AnimatePresence>
              <m.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
              >
                <button
                  type="button"
                  onClick={() => voice.startRecording()}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-white/50 transition-colors duration-200 hover:bg-white/10 active:scale-95"
                  aria-label="Record voice"
                >
                  <Mic className="size-4" />
                </button>
              </m.div>
            </AnimatePresence>
          )}
        </div>
      </form>

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
