"use client";

import { useCallback, useState } from "react";
import { Search, Plus, MessageCircle, Loader2, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { m, AnimatePresence } from "framer-motion";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ConversationItem {
  id: string;
  partner: { id: string; name: string; avatar_url: string | null };
  last_message: {
    content: string;
    created_at: string;
    sender_id: string;
  } | null;
  unread_count: number;
}

export interface ConversationListProps {
  conversations: ConversationItem[];
  activeId: string | null;
  currentUserId: string;
  onSelect: (conv: ConversationItem) => void;
  onNewChat: (partnerId: string, partnerName: string, partnerAvatar: string | null) => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return "now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d`;
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/* ------------------------------------------------------------------ */
/*  User Search Dialog                                                 */
/* ------------------------------------------------------------------ */

function NewChatDialog({
  onSelect,
}: {
  onSelect: (id: string, name: string, avatar: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    Array<{ id: string; name: string; avatar_url: string | null; email: string | null }>
  >([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      const res = await fetch("/api/users/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data.users ?? []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  }, [query]);

  const handleStartChat = useCallback(
    async (userId: string, name: string, avatar: string | null, email: string | null) => {
      setCreating(userId);
      try {
        // Use the conversations/create endpoint if we have an email,
        // otherwise directly call onSelect
        if (email) {
          const res = await fetch("/api/conversations/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ partner_email: email }),
          });
          if (res.ok) {
            const data = await res.json();
            onSelect(data.partner.id, data.partner.name, data.partner.avatar_url);
            setOpen(false);
            setQuery("");
            setResults([]);
          }
        } else {
          onSelect(userId, name, avatar);
          setOpen(false);
          setQuery("");
          setResults([]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setCreating(null);
      }
    },
    [onSelect]
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          className="size-9 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 shadow-md shadow-violet-500/20 hover:from-violet-600 hover:to-purple-700"
          aria-label="New chat"
        >
          <Plus className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden rounded-2xl border-white/[0.08] bg-zinc-950/95 backdrop-blur-xl">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base font-semibold text-white">Start a conversation</DialogTitle>
        </DialogHeader>

        {/* Search input */}
        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search by name or email..."
              className="h-10 rounded-xl border-white/[0.08] bg-white/[0.05] pl-9 pr-4 text-sm text-white placeholder:text-zinc-500 focus-visible:border-violet-500/50 focus-visible:ring-violet-500/25"
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(""); setResults([]); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="max-h-64 overflow-y-auto px-2 pb-4">
          {searching ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-zinc-500" />
            </div>
          ) : results.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {results.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  disabled={creating === user.id}
                  onClick={() => handleStartChat(user.id, user.name, user.avatar_url, user.email)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06] disabled:opacity-50"
                >
                  <Avatar className="size-9 shrink-0">
                    {user.avatar_url && (
                      <AvatarImage src={user.avatar_url} alt={user.name} />
                    )}
                    <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-xs font-semibold text-white">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{user.name}</p>
                    {user.email && (
                      <p className="truncate text-xs text-zinc-500">{user.email}</p>
                    )}
                  </div>
                  {creating === user.id && (
                    <Loader2 className="size-4 animate-spin text-zinc-500" />
                  )}
                </button>
              ))}
            </div>
          ) : query && !searching ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <MessageCircle className="size-8 text-zinc-700" />
              <p className="text-sm text-zinc-500">No users found</p>
              <p className="text-xs text-zinc-600">Try a different name or email</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Search className="size-8 text-zinc-700" />
              <p className="text-sm text-zinc-500">Type to search for users</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  ConversationList                                                   */
/* ------------------------------------------------------------------ */

export function ConversationList({
  conversations,
  activeId,
  currentUserId,
  onSelect,
  onNewChat,
}: ConversationListProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <h2 className="text-base font-bold tracking-tight">Chats</h2>
        <NewChatDialog onSelect={onNewChat} />
      </header>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-900">
              <MessageCircle className="size-7 text-zinc-300 dark:text-zinc-600" />
            </div>
            <div>
              <p className="text-sm font-medium">No conversations yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Start a new chat to begin messaging.
              </p>
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {conversations.map((conv, i) => (
              <m.button
                key={conv.id}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.15, delay: i * 0.03 }}
                onClick={() => onSelect(conv)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60",
                  activeId === conv.id && "bg-muted"
                )}
              >
                <Avatar className="size-11 shrink-0">
                  {conv.partner.avatar_url && (
                    <AvatarImage
                      src={conv.partner.avatar_url}
                      alt={conv.partner.name}
                    />
                  )}
                  <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-xs font-semibold text-white">
                    {getInitials(conv.partner.name)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">
                      {conv.partner.name}
                    </span>
                    {conv.last_message && (
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {timeAgo(conv.last_message.created_at)}
                      </span>
                    )}
                  </div>
                  {conv.last_message && (
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className="truncate text-xs text-muted-foreground">
                        {conv.last_message.sender_id === currentUserId
                          ? "You: "
                          : ""}
                        {conv.last_message.content}
                      </p>
                      {conv.unread_count > 0 && (
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-500 text-[10px] font-bold text-white">
                          {conv.unread_count > 9 ? "9+" : conv.unread_count}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </m.button>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
