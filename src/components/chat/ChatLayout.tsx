"use client";

import { type ChangeEvent, type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowUp, Mic, MicOff, X, Sticker, Paperclip, ImageIcon, Link2, Trash2, Ban, Bell, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageFeed } from "@/components/chat/MessageFeed";
import { useChat, type ChatMessage, type SendMessageOptions, type PartnerStatus } from "@/hooks/useChat";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import { cn } from "@/lib/utils";
import { m, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";

const StickerPicker = dynamic(() => import("@/components/chat/StickerPicker").then(m => ({ default: m.StickerPicker })), { ssr: false, loading: () => <div className="size-8" /> });
import { ChatBackgroundPicker, useChatBackground } from "@/components/chat/ChatBackgroundPicker";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface ChatPartner { id: string; name: string; avatar_url: string | null }
export interface ChatLayoutProps { currentUserId: string; currentUserName: string; currentUserAvatar: string | null; otherUserId: string; conversationId: string; partner: ChatPartner; initialMessages?: ChatMessage[]; devMode?: boolean }

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
            className="fixed top-16 left-1/2 z-50 -translate-x-1/2 w-[90%] max-w-md rounded-2xl border border-white/10 backdrop-blur-xl p-4"
            style={{ background: 'linear-gradient(135deg, rgba(40,40,40,0.95), rgba(20,20,20,0.98))' }}
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
              <button className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2 text-xs text-white/70 transition-all duration-200 active:scale-95" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))' }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.05))' }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))' }}>
                <ImageIcon className="size-3.5" /> Shared media
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2 text-xs text-white/70 transition-all duration-200 active:scale-95" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))' }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.05))' }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))' }}>
                <Link2 className="size-3.5" /> Shared links
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2 text-xs text-white/70 transition-all duration-200 active:scale-95" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))' }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.05))' }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))' }}>
                <Bell className="size-3.5" /> Mute
              </button>
            </div>
            {/* Destructive actions */}
            <div className="flex items-center gap-2 mt-2">
              <button className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2 text-xs text-red-400 transition-all duration-200 active:scale-95" onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.04))' }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                <Ban className="size-3.5" /> Block
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2 text-xs text-red-400 transition-all duration-200 active:scale-95" onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.04))' }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
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

export function ChatLayout({ currentUserId, currentUserName, currentUserAvatar, otherUserId, conversationId, partner, initialMessages, devMode: _devMode }: ChatLayoutProps) {
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
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadXhrRef = useRef<XMLHttpRequest | null>(null);

  /* Background is fixed full-screen — never moves with keyboard */
  const bgLayer = (
    <div
      className="fixed inset-0 z-0"
      style={wallpaper
        ? wallpaper.startsWith('url(') || wallpaper.startsWith('http')
          ? {
              backgroundImage: `url(${wallpaper})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }
          : { background: wallpaper }
        : theme.style
      }
    />
  );

  /* Content container tracks visual viewport for keyboard handling */
  const containerStyle = viewport.height > 0
    ? ({ height: `${viewport.height}px` } as React.CSSProperties)
    : ({ height: "100dvh" } as React.CSSProperties);
  const kbOffset = viewport.isKeyboardVisible && viewport.offsetTop > 0
    ? ({ marginTop: `-${viewport.offsetTop}px` } as React.CSSProperties)
    : undefined;

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

  const uploadAttachment = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      if (!attachmentFile || isUploading) { resolve(); return; }
      setIsUploading(true);
      setUploadProgress(0);

      const fd = new FormData();
      fd.append("file", attachmentFile);
      fd.append("conversation_id", conversationId);
      if (replyTo?.id) fd.append("reply_to_id", replyTo.id);
      if (vanishMode) fd.append("vanish_mode", "true");
      if (ephemeralSeconds) fd.append("ephemeral_seconds", String(ephemeralSeconds));

      const xhr = new XMLHttpRequest();
      uploadXhrRef.current = xhr;

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(pct);
        }
      });

      xhr.addEventListener("load", () => {
        uploadXhrRef.current = null;
        if (xhr.status >= 200 && xhr.status < 300) {
          clearAttachment();
          setReplyTo(null);
          resolve();
        } else {
          let errMsg = `Upload failed: ${xhr.status}`;
          try { const d = JSON.parse(xhr.responseText); errMsg = d.error || errMsg; } catch {}
          reject(new Error(errMsg));
        }
      });

      xhr.addEventListener("error", () => {
        uploadXhrRef.current = null;
        reject(new Error("Network error during upload"));
      });

      xhr.addEventListener("abort", () => {
        uploadXhrRef.current = null;
        reject(new Error("Upload cancelled"));
      });

      xhr.open("POST", "/api/messages/upload");
      xhr.send(fd);
    });
  }, [attachmentFile, isUploading, conversationId, replyTo, vanishMode, ephemeralSeconds, clearAttachment]);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    /* If an attachment is selected, upload it instead of sending text */
    if (hasAttachment && !hasText) {
      try { await uploadAttachment(); } catch (err) {
        console.error("[ChatLayout] upload error:", err);
        toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Could not send the file.", variant: "destructive" });
      } finally { setUploadProgress(0); }
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
      if (hasAttachment) {
        try { await uploadAttachment(); } catch (err) {
          console.error("[ChatLayout] upload error:", err);
          toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Could not send the file.", variant: "destructive" });
        } finally { setUploadProgress(0); }
      }
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
    <div className="relative w-full" style={containerStyle}>
      {bgLayer}
      <div style={kbOffset} className="relative z-10 flex min-h-0 h-full flex-col">
        {/* Floating pill header — accounts for safe area inset on notched phones */}
        <header className="shrink-0 z-30 mx-3 mt-2 flex items-center gap-3 rounded-full py-2 px-4 backdrop-blur-2xl bg-transparent border border-white/[0.08] transition-all duration-300" style={{ marginTop: 'max(8px, env(safe-area-inset-top, 0px))' }}>
          <button
            type="button"
            onClick={() => setInfoPanelOpen(true)}
            className="flex flex-1 items-center gap-3 rounded-lg p-0 transition-all duration-200 focus-visible:outline-none active:scale-[0.98]" onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))' }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
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
          <div className="shrink-0 flex items-center gap-1">
            <ChatBackgroundPicker themeId={themeId} onSelect={selectTheme} wallpaper={wallpaper} onSetWallpaper={setWallpaper} />
          </div>
        </header>

        {/* Feed area — padding accounts for safe area + floating header/input */}
        {/* Feed area — spacer for input pill at bottom */}
        <div className="relative min-h-0 flex-1" style={{ paddingBottom: 'calc(64px + max(28px, calc(env(safe-area-inset-bottom, 0px) + 12px)))' }}>
          <MessageFeed
            messages={messages}
            isLoading={isLoading}
            isPartnerTyping={isPartnerTyping}
            currentUserId={currentUserId}
            partnerName={partner.name}
            partnerAvatar={partner.avatar_url}
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
          className="absolute left-1/2 -translate-x-1/2 w-[90%] max-w-lg z-30 flex flex-col gap-1.5"
          style={{ bottom: 'calc(max(28px, calc(env(safe-area-inset-bottom, 0px) + 12px)) + 60px)' }}
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
                style={{ background: 'linear-gradient(135deg, var(--app-accent-subtle), rgba(255,255,255,0.03))', borderColor: "var(--app-accent-subtle)" }}
              >
                <div className="flex items-center gap-3 px-4 py-2.5">
                  {attachmentPreview ? (
                    <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-white/10">
                      <img src={attachmentPreview} alt={attachmentFile.name} className="size-full object-cover" />
                    </div>
                  ) : (
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, var(--app-accent-subtle), rgba(255,255,255,0.03))', color: "var(--app-accent)" }}>
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
                    <div className="flex shrink-0 flex-col items-center gap-1.5">
                      <Loader2 className="size-5 animate-spin" style={{ color: "var(--app-accent)" }} />
                      <span className="text-[10px] font-medium tabular-nums" style={{ color: "var(--app-accent)" }}>{uploadProgress}%</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={clearAttachment}
                      className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-all duration-200 hover:text-foreground active:scale-95"
                      aria-label="Remove attachment"
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
                {isUploading && (
                  <div className="mx-4 mb-2 h-1 overflow-hidden rounded-full" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))' }}>
                    <m.div
                      className="h-full rounded-full"
                      style={{ background: 'linear-gradient(90deg, var(--app-accent-from), var(--app-accent-to))' }}
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                    />
                  </div>
                )}
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
                style={{ background: 'linear-gradient(135deg, var(--app-accent-subtle), rgba(255,255,255,0.03))', borderLeft: "2px solid var(--app-accent)" }}
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
                      className="flex size-6 items-center justify-center rounded-full text-muted-foreground transition-all duration-200 active:scale-95"
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <X className="size-3.5" />
                    </button>
                    <kbd className="hidden sm:inline-flex h-5 items-center rounded border px-1.5 text-[10px] font-medium text-muted-foreground" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))' }}>Esc</kbd>
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
            "absolute left-1/2 -translate-x-1/2",
            "w-[90%] max-w-lg",
            "rounded-full",
            "backdrop-blur-2xl bg-transparent",
            "border border-white/[0.08]",
            "p-1.5 px-3 z-40",
            "flex items-center gap-2",
            "transition-all duration-200",
            "focus-within:border-white/[0.12]",
          )}
          style={{ bottom: 'max(28px, calc(env(safe-area-inset-bottom, 0px) + 12px))' }}
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
            <StickerPicker
              onSelect={(sticker) => {
                const ta = inputRef.current;
                if (!ta) return;
                const start = ta.selectionStart ?? draft.length;
                const end = ta.selectionEnd ?? draft.length;
                const before = draft.slice(0, start);
                const after = draft.slice(end);
                setDraft(before + sticker + after);
                requestAnimationFrame(() => {
                  const pos = start + sticker.length;
                  ta.focus();
                  ta.setSelectionRange(pos, pos);
                });
              }}
            >
              <button
                type="button"
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-white/50 transition-colors duration-200 hover:text-white/80 active:scale-95"
                aria-label="Stickers"
              >
                <Sticker className="size-4" />
              </button>
            </StickerPicker>
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
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-red-500 transition-all duration-200 active:scale-95"
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.04))' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
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
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-white/50 transition-all duration-200 active:scale-95"
                  aria-label="Record voice"
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
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
