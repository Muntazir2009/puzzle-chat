"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Loader2, LogOut, Settings } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { ConversationList, type ConversationItem } from "./ConversationList";
import { ChatLayout } from "./ChatLayout";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { m, AnimatePresence } from "framer-motion";

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

  /* ---- Fetch conversations ---------------------------------------- */
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

  /* ---- Handle conversation selection ----------------------------- */
  const handleSelectConversation = useCallback((conv: ConversationItem) => {
    setActiveConv(conv);
  }, []);

  /* ---- Handle new chat (from dialog) ------------------------------ */
  const handleNewChat = useCallback(
    (partnerId: string, partnerName: string, partnerAvatar: string | null) => {
      // Check if conversation already exists in the list
      const existing = conversations.find((c) => c.partner.id === partnerId);
      if (existing) {
        setActiveConv(existing);
        return;
      }
      // Create a temporary conversation item
      const newConv: ConversationItem = {
        id: `temp-${partnerId}`,
        partner: { id: partnerId, name: partnerName, avatar_url: partnerAvatar },
        last_message: null,
        unread_count: 0,
      };
      setConversations((prev) => [newConv, ...prev]);
      setActiveConv(newConv);
      // Re-fetch to get the real conversation ID
      fetchConversations();
    },
    [conversations, fetchConversations],
  );

  /* ---- Sign out --------------------------------------------------- */
  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }, [supabase, router]);

  /* ---- Conversation changed via new chat (update active) --------- */
  useEffect(() => {
    if (!activeConv) return;
    // If the active conv was a temp one, replace with the real one
    if (activeConv.id.startsWith("temp-")) {
      const real = conversations.find((c) => c.partner.id === activeConv.partner.id);
      if (real && real.id !== activeConv.id) {
        setActiveConv(real);
      }
    }
  }, [conversations, activeConv]);

  /* ---- Render sidebar header user menu ---------------------------- */
  const userMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 rounded-lg">
          <Settings className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="flex items-center gap-3 px-2 py-1.5">
          <Avatar className="size-8">
            {userAvatar && <AvatarImage src={userAvatar} alt={userName} />}
            <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-[10px] font-semibold text-white">
              {userName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{userName}</p>
            {userEmail && (
              <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
            )}
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} disabled={signingOut} className="text-red-500 focus:text-red-500">
          <LogOut className="mr-2 size-4" />
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  /* ---- Loading state --------------------------------------------- */
  if (loading) {
    return (
      <div className="flex h-dvh w-full flex-col items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">Loading chats…</p>
      </div>
    );
  }

  /* ---- No conversation selected (desktop shows list + empty) ----- */
  const emptyState = (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-600/10">
        <svg className="size-8 text-violet-400/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-medium">Select a conversation</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose from your existing chats or start a new one.
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh w-full flex-col bg-background">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden sm:flex-row">
        {/* ---- Desktop sidebar ------------------------------------ */}
        <aside className="hidden w-80 shrink-0 flex-col border-r sm:flex">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600">
                <svg className="size-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <span className="text-sm font-bold tracking-tight">Puzzle</span>
            </div>
            {userMenu}
          </div>
          <div className="min-h-0 flex-1">
            <ConversationList
              conversations={conversations}
              activeId={activeConv?.id ?? null}
              currentUserId={userId}
              onSelect={handleSelectConversation}
              onNewChat={handleNewChat}
            />
          </div>
        </aside>

        {/* ---- Mobile: show conversation list or chat view --------- */}
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
                {/* Mobile header */}
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600">
                      <svg className="size-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <span className="text-sm font-bold tracking-tight">Puzzle</span>
                  </div>
                  {userMenu}
                </div>
                <div className="min-h-0 flex-1">
                  <ConversationList
                    conversations={conversations}
                    activeId={null}
                    currentUserId={userId}
                    onSelect={handleSelectConversation}
                    onNewChat={handleNewChat}
                  />
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
                {/* Back button overlay on mobile */}
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
                {/* Floating back button */}
                <button
                  type="button"
                  onClick={() => setActiveConv(null)}
                  className="absolute left-3 top-3 z-20 flex size-8 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm shadow-sm border transition-colors hover:bg-muted"
                  aria-label="Back to chats"
                >
                  <ArrowLeft className="size-4" />
                </button>
              </m.div>
            )}
          </AnimatePresence>
        </div>

        {/* ---- Desktop: chat area or empty state -------------------- */}
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
  );
}
