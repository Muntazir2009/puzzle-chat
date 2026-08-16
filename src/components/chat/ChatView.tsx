"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, LogOut, Settings } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { ConversationList, type ConversationItem } from "./ConversationList";
import { ChatLayout } from "./ChatLayout";
import { ProfileDialog } from "./ProfileDialog";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
/*  Theme selector circles                                             */
/* ------------------------------------------------------------------ */

const THEME_OPTIONS: { id: AppTheme; label: string; color: string }[] = [
  { id: "default", label: "Violet", color: "#8b5cf6" },
  { id: "golden", label: "Golden", color: "#f59e0b" },
  { id: "crimson", label: "Crimson", color: "#e11d48" },
];

function ThemeSelector() {
  const { theme, setTheme } = useAppTheme();
  return (
    <div className="flex items-center justify-center gap-2 px-2 py-1.5">
      {THEME_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => setTheme(opt.id)}
          title={opt.label}
          aria-label={`Theme: ${opt.label}`}
          className={cn(
            "size-5 rounded-full transition-all duration-200",
          )}
          style={{
            backgroundColor: opt.color,
            boxShadow: theme === opt.id ? `0 0 0 2px var(--background), 0 0 0 3.5px ${opt.color}` : "none",
            transform: theme === opt.id ? "scale(1.15)" : "scale(1)",
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Puzzle Logo                                                        */
/* ------------------------------------------------------------------ */

function PuzzleLogo({ unreadCount }: { unreadCount: number }) {
  return (
    <div className="relative flex items-center gap-2.5">
      <div
        className="relative flex size-8 items-center justify-center rounded-xl text-white"
        style={{
          background: "linear-gradient(to bottom right, var(--app-accent-from), var(--app-accent-to))",
          boxShadow: `0 4px 6px -1px var(--app-accent-glow)`,
        }}
      >
        <svg className="size-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {unreadCount > 0 && (
          <span className={cn(
            "absolute -right-1 -top-1 flex items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-background",
            unreadCount > 99 ? "min-w-[24px]" : "min-w-[16px]"
          )}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </div>
      <span className="text-sm font-bold tracking-tight">Puzzle</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ChatView                                                           */
/* ------------------------------------------------------------------ */

export function ChatView({ userId, userName, userAvatar, userEmail }: ChatViewProps) {
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

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unread_count, 0),
    [conversations]
  );

  /* Update browser tab title with unread count */
  useEffect(() => {
    const base = "Puzzle";
    document.title = totalUnread > 0 ? `(${totalUnread > 99 ? "99+" : totalUnread}) ${base}` : base;
    return () => { document.title = base; };
  }, [totalUnread]);

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

  const handleSelectConversation = useCallback((conv: ConversationItem) => {
    setActiveConv(conv);
  }, []);

  const handleNewChat = useCallback(
    async (partnerId: string, partnerName: string, partnerAvatar: string | null) => {
      const existing = conversations.find((c) => c.partner.id === partnerId);
      if (existing) { setActiveConv(existing); return; }

      /* Create conversation on the server */
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
          last_message: null, unread_count: 0,
        };
        setConversations((prev) => [realConv, ...prev]);
        setActiveConv(realConv);
      } catch (err) {
        console.error("[ChatView] create conversation error:", err);
      }
    },
    [conversations],
  );

  const handleDeleteConversation = useCallback(async (convId: string) => {
    setDeletingConv(convId);
    try {
      await fetch("/api/conversations/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: convId }),
      });
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConv?.id === convId) setActiveConv(null);
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingConv(null);
    }
  }, [activeConv]);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }, [supabase, router]);

  const userInitials = localUserName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  /* ---- User menu --------------------------------------------------- */
  const userMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 rounded-lg">
          <Settings className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="relative">
            <div className="absolute -inset-1 rounded-full blur-sm" style={{ background: "linear-gradient(to bottom right, var(--app-accent-from), var(--app-accent-to))", opacity: 0.3 }} />
            <Avatar className="relative size-11 ring-2 ring-[var(--app-accent-lighter)]/30 dark:ring-[var(--app-accent)]/40">
              {localUserAvatar && <AvatarImage src={localUserAvatar} alt={localUserName} />}
              <AvatarFallback
                className="text-sm font-bold text-white"
                style={{ background: "linear-gradient(to bottom right, var(--app-accent-from), var(--app-accent-to))" }}
              >
                {userInitials}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{localUserName}</p>
            {userEmail && <p className="truncate text-xs text-muted-foreground">{userEmail}</p>}
          </div>
        </div>
        <DropdownMenuSeparator />
        <ThemeSelector />
        <DropdownMenuSeparator />
        <ProfileDialog
          userId={userId}
          userName={localUserName}
          userAvatar={localUserAvatar}
          userEmail={userEmail}
          onNameChange={setLocalUserName}
          onAvatarChange={setLocalUserAvatar}
        />
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} disabled={signingOut} className="text-red-500 focus:text-red-500">
          <LogOut className="mr-2 size-4" />
          {signingOut ? "Signing out\u2026" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  /* ---- Loading ----------------------------------------------------- */
  if (loading) {
    return (
      <div className="flex h-dvh w-full flex-col bg-background">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden sm:flex-row">
          <aside className="hidden w-80 shrink-0 flex-col border-r sm:flex">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2.5">
                <Skeleton className="size-8 rounded-xl" />
                <Skeleton className="h-4 w-14" />
              </div>
              <Skeleton className="size-8 rounded-lg" />
            </div>
            <div className="flex flex-col gap-0 p-0">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 border-l-[3px] border-l-transparent px-4 py-3.5">
                  <Skeleton className="size-11 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-8" />
                    </div>
                    <div className="mt-1"><Skeleton className="h-3 w-36" /></div>
                  </div>
                </div>
              ))}
            </div>
          </aside>
          <main className="hidden min-h-0 flex-1 flex-col sm:flex">
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading chats\u2026</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  /* ---- Empty state ------------------------------------------------ */
  const emptyState = (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="relative">
        <div className="absolute -inset-3 rounded-3xl blur-xl" style={{ background: "linear-gradient(to bottom right, var(--app-accent-from), var(--app-accent-to))", opacity: 0.15 }} />
        <div className="relative flex size-20 items-center justify-center rounded-3xl" style={{ background: "linear-gradient(to bottom right, var(--app-accent-from), var(--app-accent-to))", opacity: 0.1 }}>
          <svg className="size-9" style={{ color: "var(--app-accent-light)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold">Select a conversation</p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          Choose from your existing chats or start a new one.
        </p>
      </div>
    </div>
  );

  /* ---- Shared ConversationList props ------------------------------- */
  const listProps = {
    conversations,
    currentUserId: userId,
    onSelect: handleSelectConversation,
    onNewChat: handleNewChat,
    onDelete: handleDeleteConversation,
    deletingId: deletingConv,
  };

  /* ---- Render ----------------------------------------------------- */
  return (
    <ThemeProvider>
    <div className="flex h-dvh w-full flex-col bg-background">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden sm:flex-row">
        {/* Desktop sidebar */}
        <aside className="hidden w-80 shrink-0 flex-col border-r sm:flex">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <PuzzleLogo unreadCount={totalUnread} />
            {userMenu}
          </div>
          <div className="min-h-0 flex-1">
            <ConversationList {...listProps} activeId={activeConv?.id ?? null} />
          </div>
        </aside>

        {/* Mobile: list or chat */}
        <div className="flex min-h-0 flex-1 flex-col sm:hidden">
          <AnimatePresence mode="wait">
            {!activeConv ? (
              <m.div
                key="mobile-list"
                initial={{ opacity: 0, x: 0 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.2 }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <PuzzleLogo unreadCount={totalUnread} />
                  {userMenu}
                </div>
                <div className="min-h-0 flex-1">
                  <ConversationList {...listProps} activeId={null} />
                </div>
              </m.div>
            ) : (
              <m.div
                key="mobile-chat"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ duration: 0.2 }}
                className="relative flex min-h-0 flex-1 flex-col"
              >
                <ErrorBoundary>
                <ChatLayout
                  currentUserId={userId}
                  otherUserId={activeConv.partner.id}
                  conversationId={activeConv.id}
                  partner={{
                    id: activeConv.partner.id,
                    name: activeConv.partner.name,
                    avatar_url: activeConv.partner.avatar_url,
                  }}
                />
                </ErrorBoundary>
                <button
                  type="button"
                  onClick={() => setActiveConv(null)}
                  className="absolute left-3 top-3 z-20 flex size-8 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm border shadow-sm transition-colors hover:bg-muted"
                  aria-label="Back to chats"
                >
                  <ArrowLeft className="size-4" />
                </button>
              </m.div>
            )}
          </AnimatePresence>
        </div>

        {/* Desktop: chat area or empty state */}
        <main className="hidden min-h-0 flex-1 flex-col sm:flex">
          <AnimatePresence mode="wait">
            {activeConv ? (
              <m.div
                key={activeConv.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.15 }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <ErrorBoundary>
                <ChatLayout
                  currentUserId={userId}
                  otherUserId={activeConv.partner.id}
                  conversationId={activeConv.id}
                  partner={{
                    id: activeConv.partner.id,
                    name: activeConv.partner.name,
                    avatar_url: activeConv.partner.avatar_url,
                  }}
                />
                </ErrorBoundary>
              </m.div>
            ) : (
              <m.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex min-h-0 flex-1 flex-col"
              >
                {emptyState}
              </m.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
    </ThemeProvider>
  );
}