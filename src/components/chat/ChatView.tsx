"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2, LogOut, MessageSquare, Settings } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { ConversationList, type ConversationItem } from "./ConversationList";
import { ChatLayout } from "./ChatLayout";
import { ProfileDialog } from "./ProfileDialog";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
    <div className="flex items-center justify-center gap-2.5 px-2 py-1.5">
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
/*  Nav Pill                                                          */
/* ------------------------------------------------------------------ */

type NavTarget = "chats" | "settings";

function NavPill({
  activeNav,
  onNavChange,
  unreadCount,
  settingsContent,
}: {
  activeNav: NavTarget;
  onNavChange: (t: NavTarget) => void;
  unreadCount: number;
  settingsContent: React.ReactNode;
}) {
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicatorY, setIndicatorY] = useState(0);
  const [indicatorH, setIndicatorH] = useState(40);

  useEffect(() => {
    const idx = activeNav === "chats" ? 0 : 1;
    const el = itemRefs.current[idx];
    if (el) {
      const parent = el.parentElement;
      if (parent) {
        const parentRect = parent.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const y = elRect.top - parentRect.top;
        setIndicatorY(y);
        setIndicatorH(elRect.height);
      }
    }
  }, [activeNav]);

  return (
    <div
      className={cn(
        "relative fixed left-2 top-1/2 z-50 flex -translate-y-1/2 w-12 flex-col items-center gap-2 rounded-full py-3 px-1.5 shadow-xl",
        "sm:left-5",
        "backdrop-blur-xl border border-white/10 bg-black/80",
      )}
    >
      {/* Sliding active indicator — background highlight behind active icon */}
      <m.div
        className="absolute left-1 right-1 rounded-full bg-white/10"
        animate={{ y: indicatorY, height: indicatorH }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      />

      {/* Chats icon */}
      <button
        ref={(el) => { itemRefs.current[0] = el; }}
        type="button"
        onClick={() => onNavChange("chats")}
        aria-label="Chats"
        className={cn(
          "relative z-10 flex size-10 items-center justify-center rounded-full transition-colors duration-150 ease-out",
          activeNav === "chats" ? "text-white" : "text-white/50 hover:text-white/90",
        )}
      >
        <MessageSquare className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-[16px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-black/80">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Settings icon — opens popover */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            ref={(el) => { itemRefs.current[1] = el; }}
            type="button"
            aria-label="Settings"
            className={cn(
              "relative z-10 flex size-10 items-center justify-center rounded-full transition-colors duration-150 ease-out",
              activeNav === "settings" ? "text-white" : "text-white/50 hover:text-white/90",
            )}
          >
            <Settings className="size-5" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="start"
          sideOffset={12}
          onOpenChange={(open) => {
            if (open) onNavChange("settings");
          }}
          className="w-64 border border-white/10 bg-neutral-900/90 p-0 backdrop-blur-xl rounded-2xl text-white shadow-2xl transform-gpu"
        >
          {settingsContent}
        </PopoverContent>
      </Popover>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ChatView                                                           */
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
  const [activeNav, setActiveNav] = useState<NavTarget>("chats");

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unread_count, 0),
    [conversations],
  );

  /* Update browser tab title with unread count */
  useEffect(() => {
    const base = "Puzzle";
    document.title =
      totalUnread > 0
        ? `(${totalUnread > 99 ? "99+" : totalUnread}) ${base}`
        : base;
    return () => {
      document.title = base;
    };
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

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleSelectConversation = useCallback((conv: ConversationItem) => {
    setActiveConv(conv);
  }, []);

  const handleNewChat = useCallback(
    async (
      partnerId: string,
      partnerName: string,
      partnerAvatar: string | null,
    ) => {
      const existing = conversations.find((c) => c.partner.id === partnerId);
      if (existing) {
        setActiveConv(existing);
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
          partner: {
            id: data.partner.id,
            name: data.partner.name,
            avatar_url: data.partner.avatar_url,
          },
          last_message: null,
          unread_count: 0,
        };
        setConversations((prev) => [realConv, ...prev]);
        setActiveConv(realConv);
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
        if (activeConv?.id === convId) setActiveConv(null);
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

  const userInitials = localUserName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  /* ---- Settings popover content ----------------------------------- */
  const settingsPopoverContent = (
    <div className="flex flex-col gap-0">
      {/* User info header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="relative shrink-0">
          <div
            className="absolute -inset-1 rounded-full blur-sm"
            style={{
              background:
                "linear-gradient(to bottom right, var(--app-accent-from), var(--app-accent-to))",
              opacity: 0.3,
            }}
          />
          <Avatar className="relative size-11 ring-2 ring-white/10">
            {localUserAvatar && (
              <AvatarImage src={localUserAvatar} alt={localUserName} />
            )}
            <AvatarFallback
              className="text-sm font-bold text-white"
              style={{
                background:
                  "linear-gradient(to bottom right, var(--app-accent-from), var(--app-accent-to))",
              }}
            >
              {userInitials}
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">
            {localUserName}
          </p>
          {userEmail && (
            <p className="truncate text-xs text-white/50">{userEmail}</p>
          )}
        </div>
      </div>

      <Separator className="bg-white/10" />

      {/* Theme selector */}
      <div className="px-4 py-3">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-white/40">
          Theme
        </p>
        <ThemeSelector />
      </div>

      <Separator className="bg-white/10" />

      {/* Profile dialog */}
      <div className="px-4 py-3">
        <ProfileDialog
          userId={userId}
          userName={localUserName}
          userAvatar={localUserAvatar}
          userEmail={userEmail}
          onNameChange={setLocalUserName}
          onAvatarChange={setLocalUserAvatar}
        />
      </div>

      <Separator className="bg-white/10" />

      {/* Sign out */}
      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-sm text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
      >
        <LogOut className="size-4" />
        {signingOut ? "Signing out\u2026" : "Sign out"}
      </button>
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

  /* ---- Loading ----------------------------------------------------- */
  if (loading) {
    return (
      <ThemeProvider>
        <div className="h-dvh w-full bg-background">
          {/* Nav pill skeleton */}
          <div className="fixed left-2 top-1/2 z-50 flex -translate-y-1/2 w-12 flex-col items-center gap-2 rounded-full py-3 px-1.5 sm:left-5 backdrop-blur-xl border border-white/10 bg-black/80 shadow-xl">
            <Skeleton className="size-5 rounded" />
            <Skeleton className="size-5 rounded" />
          </div>
          {/* Loading content */}
          <div className="flex h-full flex-col items-center justify-center gap-3 pl-14 sm:pl-20">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Loading chats\u2026
            </p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  /* ---- Render ----------------------------------------------------- */
  return (
    <ThemeProvider>
      <div className="h-dvh w-full bg-background">
        {/* Floating Nav Pill */}
        <NavPill
          activeNav={activeConv ? "chats" : activeNav}
          onNavChange={setActiveNav}
          unreadCount={totalUnread}
          settingsContent={settingsPopoverContent}
        />

        <AnimatePresence mode="wait">
          {!activeConv ? (
            /* ---- Conversation list (centered) ---- */
            <m.div
              key="conv-list"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {/* Small branding header */}
              <div className="flex items-center justify-center gap-2.5 pl-14 sm:pl-16 pt-6 pb-2">
                <div
                  className="flex size-8 items-center justify-center rounded-xl text-white"
                  style={{
                    background:
                      "linear-gradient(to bottom right, var(--app-accent-from), var(--app-accent-to))",
                  }}
                >
                  <MessageSquare className="size-4" />
                </div>
                <span className="text-lg font-bold tracking-tight">
                  Puzzle
                </span>
              </div>

              {/* Conversation list container */}
              <div className="mx-auto h-[calc(100%-60px)] max-w-lg overflow-y-auto pl-14 sm:pl-16">
                <ConversationList
                  {...listProps}
                  activeId={null}
                />
              </div>
            </m.div>
          ) : (
            /* ---- Active chat ---- */
            <m.div
              key={activeConv.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15 }}
              className="relative h-full"
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

              {/* Mobile back button — to the right of the nav pill */}
              <button
                type="button"
                onClick={() => setActiveConv(null)}
                className="absolute left-14 sm:left-16 top-3 z-20 flex size-8 items-center justify-center rounded-full bg-background/80 shadow-sm backdrop-blur-sm transition-colors hover:bg-muted sm:hidden"
                style={{ border: "1px solid var(--app-accent-subtle)" }}
                aria-label="Back to chats"
              >
                <ArrowLeft className="size-4" />
              </button>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </ThemeProvider>
  );
}
