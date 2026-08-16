"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Plus, MessageCircle, Loader2, X, Trash2 } from "lucide-react";
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
import { useHeartbeat } from "@/hooks/useHeartbeat";

export interface ConversationItem {
  id: string;
  partner: { id: string; name: string; avatar_url: string | null };
  last_message: { content: string; created_at: string; sender_id: string } | null;
  unread_count: number;
}

export interface ConversationListProps {
  conversations: ConversationItem[];
  activeId: string | null;
  currentUserId: string;
  onSelect: (conv: ConversationItem) => void;
  onNewChat: (partnerId: string, partnerName: string, partnerAvatar: string | null) => void;
  onDelete?: (convId: string) => void;
  deletingId?: string | null;
}

type OnlineMap = Record<string, boolean>;

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s`;
  if (diffSec < 120) return "1m";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 7200) return "1h";
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  // Check for yesterday
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "yesterday";
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

/* ------------------------------------------------------------------ */
/*  NewChatDialog                                                     */
/* ------------------------------------------------------------------ */

function NewChatDialog({ onSelect }: { onSelect: (id: string, name: string, avatar: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ id: string; name: string; avatar_url: string | null; email: string | null }>>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setSearching(true);
    try {
      const res = await fetch("/api/users/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q.trim() }),
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
  }, []);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length >= 1) {
      debounceRef.current = setTimeout(() => handleSearch(value), 300);
    } else {
      setResults([]);
    }
  }, [handleSearch]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const handleStartChat = useCallback(async (uid: string, name: string, avatar: string | null) => {
    setCreating(uid);
    try {
      onSelect(uid, name, avatar);
      setOpen(false);
      setQuery("");
      setResults([]);
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(null);
    }
  }, [onSelect]);

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setQuery(""); setResults([]); } }}>
      <DialogTrigger asChild>
        <Button size="icon" className="size-9 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 shadow-md shadow-violet-500/20 hover:from-violet-600 hover:to-purple-700" aria-label="New chat">
          <Plus className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base font-semibold">Start a conversation</DialogTitle>
        </DialogHeader>
        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => handleQueryChange(e.target.value)} placeholder="Search by name..." className="h-10 rounded-xl pl-9 pr-9" />
            {query && (
              <button type="button" onClick={() => { setQuery(""); setResults([]); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto px-2 pb-4">
          {searching ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
          ) : results.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {results.map((user) => (
                <button key={user.id} type="button" disabled={creating === user.id} onClick={() => handleStartChat(user.id, user.name, user.avatar_url)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted disabled:opacity-50">
                  <Avatar className="size-9 shrink-0">
                    {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.name} />}
                    <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-xs font-semibold text-white">{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{user.name}</p>
                  </div>
                  {creating === user.id && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                </button>
              ))}
            </div>
          ) : query ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
                <MessageCircle className="size-7 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">No users found</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
                <Search className="size-7 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">Type to search for users</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  ConversationItemRow                                                */
/* ------------------------------------------------------------------ */

function ConversationItemRow({ conv, activeId, currentUserId, isOnline, onSelect, onContextMenu, index }: {
  conv: ConversationItem;
  activeId: string | null;
  currentUserId: string;
  isOnline: boolean;
  onSelect: (conv: ConversationItem) => void;
  onContextMenu: (e: React.MouseEvent, conv: ConversationItem) => void;
  index: number;
}) {
  return (
    <>
    {/* Subtle separator between conversation items */}
    {index > 0 && (
      <div className="absolute left-12 right-4 top-0 h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />
    )}
    <m.button
      type="button"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16 }}
      onClick={() => onSelect(conv)}
      onContextMenu={(e) => onContextMenu(e, conv)}
      className={cn(
        "group relative flex w-full items-center gap-3 px-4 py-3.5 text-left transition-all duration-300 ease-out",
        // Left border accent with gradient effect on hover
        "border-l-[3px] border-l-transparent",
        "hover:border-l-violet-400/70 hover:bg-gradient-to-r hover:from-violet-500/[0.06] hover:to-transparent hover:pl-[18px]",
        // Active state with violet gradient left border
        activeId === conv.id && [
          "bg-gradient-to-r from-violet-500/[0.10] to-transparent",
          "border-l-violet-500",
          "pl-[18px]",
        ],
      )}
    >
      <div className="relative shrink-0">
        <Avatar className="size-11 ring-2 ring-transparent transition-all duration-200 group-hover:ring-violet-200/30 dark:group-hover:ring-violet-500/20">
          {conv.partner.avatar_url && <AvatarImage src={conv.partner.avatar_url} alt={conv.partner.name} />}
          <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-xs font-semibold text-white">{getInitials(conv.partner.name)}</AvatarFallback>
        </Avatar>
        {isOnline && (
          <span className="absolute bottom-0 right-0 size-3 rounded-full bg-emerald-500 ring-2 ring-background" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("truncate text-sm transition-colors duration-200", activeId === conv.id ? "font-bold" : "font-semibold")}>{conv.partner.name}</span>
          {conv.last_message && (
            <span className={cn("shrink-0 text-[11px] tabular-nums transition-colors duration-200", activeId === conv.id ? "text-foreground/40" : "text-muted-foreground/70", conv.unread_count > 0 && "font-medium text-violet-500")}>{timeAgo(conv.last_message.created_at)}</span>
          )}
        </div>
        {conv.last_message && (
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className={cn("truncate text-xs", activeId === conv.id && conv.unread_count > 0 ? "text-foreground/70 font-medium" : "text-muted-foreground")}>{conv.last_message.sender_id === currentUserId ? "You: " : ""}{conv.last_message.content}</p>
            {conv.unread_count > 0 && (
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-purple-500 text-[10px] font-bold text-white shadow-sm shadow-violet-500/30 ring-2 ring-background">{conv.unread_count > 9 ? "9+" : conv.unread_count}</span>
            )}
          </div>
        )}
      </div>
    </m.button>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  ConversationList (main export)                                     */
/* ------------------------------------------------------------------ */

export function ConversationList({ conversations, activeId, currentUserId, onSelect, onNewChat, onDelete, deletingId }: ConversationListProps) {
  const [ctxConv, setCtxConv] = useState<ConversationItem | null>(null);
  const [ctxPos, setCtxPos] = useState({ x: 0, y: 0 });
  const [onlineMap, setOnlineMap] = useState<OnlineMap>({});
  const [filter, setFilter] = useState("");

  /* Keep the current user's last_seen up-to-date */
  useHeartbeat();

  /* Fetch online status for all conversation partners */
  const partnerIds = useMemo(
    () => conversations.map((c) => c.partner.id),
    [conversations],
  );

  useEffect(() => {
    if (partnerIds.length === 0) return;
    let cancelled = false;
    async function fetchStatuses() {
      try {
        const res = await fetch("/api/users/batch-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_ids: partnerIds }),
        });
        if (!res.ok) return;
        const data: OnlineMap = await res.json();
        if (!cancelled) {
          // Map to { [id]: online } boolean
          const map: OnlineMap = {};
          for (const [id, status] of Object.entries(data)) {
            map[id] = Boolean((status as any)?.online);
          }
          setOnlineMap(map);
        }
      } catch {
        /* silent */
      }
    }
    fetchStatuses();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStatuses, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [partnerIds]);

  useEffect(() => {
    if (!ctxConv) return;
    const close = () => setCtxConv(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [ctxConv]);

  const handleCtx = useCallback((e: React.MouseEvent, conv: ConversationItem) => {
    e.preventDefault();
    if (onDelete) {
      setCtxConv(conv);
      setCtxPos({ x: e.clientX, y: e.clientY });
    }
  }, [onDelete]);

  const filteredConversations = useMemo(() => {
    if (!filter.trim()) return conversations;
    const q = filter.toLowerCase();
    return conversations.filter((c) =>
      c.partner.name.toLowerCase().includes(q) ||
      (c.last_message?.content.toLowerCase().includes(q) ?? false)
    );
  }, [conversations, filter]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <h2 className="text-base font-bold tracking-tight">Chats</h2>
        <NewChatDialog onSelect={onNewChat} />
      </header>

      {/* Conversation search/filter */}
      {conversations.length > 3 && (
        <div className="relative shrink-0 border-b px-3 py-2">
          <Search className="absolute left-5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter chats..."
            className="h-8 w-full rounded-lg bg-muted/60 pl-8 pr-8 text-xs outline-none placeholder:text-muted-foreground/50 focus:bg-muted focus:ring-1 focus:ring-violet-500/20 transition-all"
            aria-label="Filter conversations"
          />
          {filter && (
            <button
              type="button"
              onClick={() => setFilter("")}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
              aria-label="Clear filter"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 && conversations.length > 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Search className="size-6 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">No matching conversations</p>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-5 px-6 text-center">
            {/* Illustration: layered chat bubbles */}
            <div className="relative">
              {/* Background decorative ring */}
              <div className="absolute -inset-6 rounded-full bg-gradient-to-br from-violet-500/5 to-purple-600/5" />
              <div className="relative flex size-24 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500/10 to-purple-600/10">
                <MessageCircle className="size-12 text-violet-400/40" />
              </div>
              {/* Floating action badge */}
              <m.div
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -right-2 -top-2 flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/30 ring-4 ring-background"
              >
                <Plus className="size-4 text-white" />
              </m.div>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-semibold">No conversations yet</p>
              <p className="max-w-[200px] text-xs leading-relaxed text-muted-foreground">
                Tap the <strong className="text-violet-500">+</strong> button above to find someone and start chatting.
              </p>
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filteredConversations.map((conv, idx) => (
              <ConversationItemRow key={conv.id} conv={conv} activeId={activeId} currentUserId={currentUserId} isOnline={!!onlineMap[conv.partner.id]} onSelect={onSelect} onContextMenu={handleCtx} index={idx} />
            ))}
          </AnimatePresence>
        )}
      </div>

      <AnimatePresence>
        {ctxConv && onDelete && (
          <m.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="fixed z-50 w-48 overflow-hidden rounded-xl border bg-popover p-1 shadow-xl"
            style={{ left: ctxPos.x, top: ctxPos.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => { onDelete(ctxConv.id); setCtxConv(null); }}
              disabled={deletingId === ctxConv.id}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50"
            >
              {deletingId === ctxConv.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete conversation
            </button>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
