"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { ArrowLeft, Loader2, LogOut, MessageSquare, Settings, User, Palette, Heart, Code } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { ConversationList, type ConversationItem } from "./ConversationList";
import dynamic from "next/dynamic";
import { ChatLayout } from "./ChatLayout";
const ProfileDialog = dynamic(() => import("./ProfileDialog").then(m => ({ default: m.ProfileDialog })), { ssr: false });
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { m, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ThemeProvider, useAppTheme, type AppTheme } from "@/lib/theme-context";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface ChatViewProps {
  userId: string;
  userName: string;
  userAvatar: string | null;
  userEmail: string | null;
}

/* ------------------------------------------------------------------ */
/*  Navigation types                                                    */
/* ------------------------------------------------------------------ */

type NavView = "list" | "chat" | "settings";

/* ------------------------------------------------------------------ */
/*  Theme selector                                                     */
/* ------------------------------------------------------------------ */

const THEME_OPTIONS: { id: AppTheme; label: string; color: string }[] = [
  { id: "default", label: "Violet", color: "#8b5cf6" },
  { id: "golden", label: "Golden", color: "#f59e0b" },
  { id: "crimson", label: "Crimson", color: "#e11d48" },
];

function ThemeSelector() {
  const { theme, setTheme } = useAppTheme();
  return (
    <div className="flex items-center gap-2.5 px-2 py-1.5">
      {THEME_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => setTheme(opt.id)}
          title={opt.label}
          aria-label={`Theme: ${opt.label}`}
          className={cn("size-5 rounded-full transition-all duration-200")}
          style={{
            backgroundColor: opt.color,
            boxShadow:
              theme === opt.id
                ? `0 0 0 2px var(--background), 0 0 0 3.5px ${opt.color}`
                : "none",
            transform: theme === opt.id ? "scale(1.15)" : "scale(1)",
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Nav Pill — 2 targets: Chats + Settings */
/* ------------------------------------------------------------------ */

function NavPill({
  activeView,
  onNavigate,
  unreadCount,
}: {
  activeView: NavView;
  onNavigate: (view: NavView) => void;
  unreadCount: number;
}) {
  return (
    <div
      className={cn(
        "fixed left-2 z-50 flex flex-col items-center gap-0.5 sm:left-4",
        "rounded-3xl py-2.5 px-2",
        "liquid-nav-pill",
      )}
      style={{ top: '50%', transform: 'translateY(-50%)' }}
    >
      {/* Chats button */}
      <button
        type="button"
        onClick={() => onNavigate("list")}
        aria-label="Chats"
        className={cn(
          "relative flex size-11 items-center justify-center rounded-2xl transition-all duration-300",
          activeView === "list"
            ? "liquid-nav-active"
            : "text-white/50 hover:text-white/80 hover:bg-white/[0.08]",
        )}
      >
        <Heart className={cn("size-[18px] transition-all duration-300", activeView === "list" && "fill-current scale-110")} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-[16px] items-center justify-center rounded-full px-0.5 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-black/30"
            style={{ background: "linear-gradient(to bottom right, var(--app-accent-from), var(--app-accent-to))" }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Settings button */}
      <button
        type="button"
        onClick={() => onNavigate("settings")}
        aria-label="Settings"
        className={cn(
          "relative flex size-11 items-center justify-center rounded-2xl transition-all duration-300",
          activeView === "settings"
            ? "liquid-nav-active"
            : "text-white/50 hover:text-white/80 hover:bg-white/[0.08]",
        )}
      >
        <Settings className="size-[18px]" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Settings Page — full page, not a popover                           */
/* ------------------------------------------------------------------ */

function SettingsPage({
  userId,
  userName,
  userAvatar,
  userEmail,
  onNameChange,
  onAvatarChange,
  onSignOut,
  signingOut,
  devMode,
  setDevMode,
}: {
  userId: string;
  userName: string;
  userAvatar: string | null;
  userEmail: string | null;
  onNameChange: (name: string) => void;
  onAvatarChange: (url: string | null) => void;
  onSignOut: () => void;
  signingOut: boolean;
  devMode: boolean;
  setDevMode: (v: boolean) => void;
}) {
  const userInitials = userName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="h-full overflow-y-auto" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}>
      <div className="mx-auto max-w-lg px-4 py-6">
        {/* Page title */}
        <h1 className="text-xl font-bold tracking-tight mb-6">Settings</h1>

        {/* Profile card */}
        <div className="rounded-2xl border border-white/[0.08] p-5 mb-4" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))' }}>
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <Avatar className="size-14 ring-2 ring-white/10">
                {userAvatar && <AvatarImage src={userAvatar} alt={userName} />}
                <AvatarFallback
                  className="text-lg font-bold text-white"
                  style={{ background: "linear-gradient(to bottom right, var(--app-accent-from), var(--app-accent-to))" }}
                >
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold">{userName}</p>
              {userEmail && <p className="truncate text-sm text-white/50">{userEmail}</p>}
            </div>
          </div>
          <div className="mt-4">
            <ProfileDialog
              userId={userId}
              userName={userName}
              userAvatar={userAvatar}
              userEmail={userEmail}
              onNameChange={onNameChange}
              onAvatarChange={onAvatarChange}
            />
          </div>
        </div>

        {/* Appearance section */}
        <div className="rounded-2xl border border-white/[0.08] overflow-hidden mb-4" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))' }}>
          <div className="flex items-center gap-3 px-5 py-3.5">
            <Palette className="size-4 text-white/60" />
            <span className="text-sm font-medium">Appearance</span>
          </div>
          <Separator className="bg-white/10" />
          <div className="px-5 py-4">
            <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-white/40">Theme</p>
            <ThemeSelector />
          </div>
        </div>

        {/* Developer section */}
        <div className="rounded-2xl border border-white/[0.08] overflow-hidden mb-4" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))' }}>
          <div className="flex items-center gap-3 px-5 py-3.5">
            <Code className="size-4 text-white/60" />
            <span className="text-sm font-medium">Developer</span>
          </div>
          <Separator className="bg-white/10" />
          <div className="flex items-center justify-between px-5 py-3.5">
            <div>
              <p className="text-sm">Developer Mode</p>
              <p className="text-[11px] text-white/40">Show debug info & raw message data</p>
            </div>
            <button
              type="button"
              onClick={() => setDevMode(!devMode)}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
                devMode ? "bg-[var(--app-accent)]" : "bg-white/10"
              )}
            >
              <span className={cn(
                "pointer-events-none inline-block size-5 rounded-full bg-white shadow-sm transition-transform",
                devMode ? "translate-x-5" : "translate-x-0"
              )} />
            </button>
          </div>
        </div>

        {/* Account section */}
        <div className="rounded-2xl border border-white/[0.08] overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))' }}>
          <div className="flex items-center gap-3 px-5 py-3.5">
            <User className="size-4 text-white/60" />
            <span className="text-sm font-medium">Account</span>
          </div>
          <Separator className="bg-white/10" />
          <button
            type="button"
            onClick={onSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-2.5 px-5 py-3.5 text-sm text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
          >
            <LogOut className="size-4" />
            {signingOut ? "Signing out\u2026" : "Sign out"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ChatView — main component                                          */
/* ------------------------------------------------------------------ */

export function ChatView({
  userId,
  userName,
  userAvatar,
  userEmail,
}: ChatViewProps) {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeConv, setActiveConv] = useState<ConversationItem | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [localUserName, setLocalUserName] = useState(userName);
  const [localUserAvatar, setLocalUserAvatar] = useState(userAvatar);
  const [deletingConv, setDeletingConv] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<NavView>("list");
  const [devMode, setDevMode] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem("puzzle-dev-mode") === "true"; } catch { return false; }
  });

  /* Persist devMode to localStorage */
  useEffect(() => {
    try { localStorage.setItem("puzzle-dev-mode", String(devMode)); } catch {}
  }, [devMode]);

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unread_count, 0),
    [conversations],
  );

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data: ConversationItem[] = await res.json();
        setConversations(data);
      }
    } catch (err) {
      console.error("[ChatView] fetch conversations error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  /* Navigation handler */
  const handleNavigate = useCallback((view: NavView) => {
    if (view === "list") {
      setActiveConv(null);
      setActiveView("list");
      fetchConversations();
    } else if (view === "settings") {
      setActiveConv(null);
      setActiveView("settings");
    }
  }, [fetchConversations]);

  /* Update browser tab title with unread count */
  useEffect(() => {
    const base = "Puzzle";
    document.title =
      totalUnread > 0
        ? `(${totalUnread > 99 ? "99+" : totalUnread}) ${base}`
        : base;
    return () => { document.title = base; };
  }, [totalUnread]);

  const handleSelectConversation = useCallback((conv: ConversationItem) => {
    /* Clear unread count locally */
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unread_count: 0 } : c))
    );
    /* Mark messages as read server-side (fire and forget) */
    fetch("/api/conversations/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: conv.id }),
    }).catch(() => {});
    setActiveConv(conv);
    setActiveView("chat");
  }, []);

  const handleNewChat = useCallback(
    async (partnerId: string, partnerName: string, partnerAvatar: string | null) => {
      const existing = conversations.find((c) => c.partner.id === partnerId);
      if (existing) {
        setActiveConv(existing);
        setActiveView("chat");
        return;
      }
      try {
        const res = await fetch("/api/conversations/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ partner_id: partnerId }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const realConv: ConversationItem = {
          id: data.conversation_id,
          partner: { id: data.partner.id, name: data.partner.name, avatar_url: data.partner.avatar_url },
          last_message: null,
          unread_count: 0,
        };
        setConversations((prev) => [realConv, ...prev]);
        setActiveConv(realConv);
        setActiveView("chat");
      } catch (err) {
        console.error("[ChatView] create conversation error:", err);
      }
    },
    [conversations],
  );

  const handleDeleteConversation = useCallback(
    async (convId: string) => {
      setDeletingConv(convId);
      try {
        await fetch("/api/conversations/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversation_id: convId }),
        });
        setConversations((prev) => prev.filter((c) => c.id !== convId));
        if (activeConv?.id === convId) {
          setActiveConv(null);
          setActiveView("list");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setDeletingConv(null);
      }
    },
    [activeConv],
  );

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }, [supabase, router]);

  const listProps = {
    conversations,
    currentUserId: userId,
    onSelect: handleSelectConversation,
    onNewChat: handleNewChat,
    onDelete: handleDeleteConversation,
    deletingId: deletingConv,
  };

  /* ---- Loading */
  if (loading) {
    return (
      <ThemeProvider>
        <div className="h-dvh w-full bg-background">
          <div className="fixed left-2 top-1/2 z-50 flex -translate-y-1/2 flex-col items-center gap-0.5 rounded-3xl py-2.5 px-2 liquid-nav-pill sm:left-4">
            <Skeleton className="size-11 rounded-2xl" />
            <Skeleton className="size-11 rounded-2xl" />
          </div>
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading chats\u2026</p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  /* ---- Render */
  return (
    <ThemeProvider>
      <div className="h-dvh w-full bg-background">
        {/* Nav Pill — always visible, always functional */}
        <NavPill
          activeView={activeView}
          onNavigate={handleNavigate}
          unreadCount={totalUnread}
        />

        <AnimatePresence mode="wait">
          {activeView === "settings" ? (
            /* ---- Settings page ---- */
            <m.div
              key="settings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="h-full"
            >
              <SettingsPage
                userId={userId}
                userName={localUserName}
                userAvatar={localUserAvatar}
                userEmail={userEmail}
                onNameChange={setLocalUserName}
                onAvatarChange={setLocalUserAvatar}
                onSignOut={handleSignOut}
                signingOut={signingOut}
                devMode={devMode}
                setDevMode={setDevMode}
              />
            </m.div>
          ) : activeView === "chat" && activeConv ? (
            /* ---- Active chat ---- */
            <m.div
              key={activeConv.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="relative h-full"
            >
              <ErrorBoundary>
                <ChatLayout
                  currentUserId={userId}
                  currentUserName={localUserName}
                  currentUserAvatar={localUserAvatar}
                  otherUserId={activeConv.partner.id}
                  conversationId={activeConv.id}
                  partner={{
                    id: activeConv.partner.id,
                    name: activeConv.partner.name,
                    avatar_url: activeConv.partner.avatar_url,
                  }}
                  devMode={devMode}
                />
              </ErrorBoundary>

              {/* Mobile back button */}
              <button
                type="button"
                onClick={() => handleNavigate("list")}
                className="absolute left-12 top-2 z-20 flex size-8 items-center justify-center rounded-full bg-black/60 shadow-sm backdrop-blur-xl border border-white/10 transition-colors hover:bg-black/80 sm:left-14 sm:hidden"
                style={{ top: 'max(8px, env(safe-area-inset-top, 0px))' }}
                aria-label="Back to chats"
              >
                <ArrowLeft className="size-4" />
              </button>
            </m.div>
          ) : (
            /* ---- Conversation list ---- */
            <m.div
              key="conv-list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="h-full"
            >
              {/* Branding header */}
              <div className="flex items-center gap-2.5 pb-2 px-4" style={{ paddingTop: 'max(1rem, calc(env(safe-area-inset-top, 0px) + 8px))' }}>
                <div
                  className="flex size-8 items-center justify-center rounded-xl text-white"
                  style={{ background: "linear-gradient(to bottom right, var(--app-accent-from), var(--app-accent-to))" }}
                >
                  <MessageSquare className="size-4" />
                </div>
                <span className="text-lg font-bold tracking-tight">Puzzle</span>
              </div>

              {/* Conversation list */}
              <div className="mx-auto h-[calc(100%-60px)] max-w-lg overflow-y-auto">
                <ConversationList {...listProps} activeId={null} />
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </ThemeProvider>
  );
}
