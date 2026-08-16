"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return "now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

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

function ConversationItemRow({ conv, activeId, currentUserId, onSelect, onContextMenu }: {
  conv: ConversationItem;
  activeId: string | null;
  currentUserId: string;
  onSelect: (conv: ConversationItem) => void;
  onContextMenu: (e: React.MouseEvent, conv: ConversationItem) => void;
}) {
  return (
    <m.button
      type="button"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16 }}
      onClick={() => onSelect(conv)}
      onContextMenu={(e) => onContextMenu(e, conv)}
      className={cn(
        "group relative flex w-full items-center gap-3 px-4 py-3.5 text-left transition-all duration-200",
        "hover:bg-muted/50 hover:border-l-2 hover:border-l-violet-300/60",
        activeId === conv.id
          ? "bg-muted/70 border-l-[3px] border-l-violet-500"
          : "border-l-[3px] border-l-transparent",
      )}
    >
      <Avatar className="size-11 shrink-0 ring-2 ring-transparent transition-all duration-200 group-hover:ring-violet-200/30 dark:group-hover:ring-violet-500/20">
        {conv.partner.avatar_url && <AvatarImage src={conv.partner.avatar_url} alt={conv.partner.name} />}
        <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-xs font-semibold text-white">{getInitials(conv.partner.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("truncate text-sm transition-colors duration-200", activeId === conv.id ? "font-bold" : "font-semibold")}>{conv.partner.name}</span>
          {conv.last_message && (
            <span className={cn("shrink-0 text-[11px] tabular-nums", activeId === conv.id ? "text-foreground/50" : "text-muted-foreground", conv.unread_count > 0 && "font-medium")}>{timeAgo(conv.last_message.created_at)}</span>
          )}
        </div>
        {conv.last_message && (
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className={cn("truncate text-xs", activeId === conv.id && conv.unread_count > 0 ? "text-foreground/70 font-medium" : "text-muted-foreground")}>{conv.last_message.sender_id === currentUserId ? "You: " : ""}{conv.last_message.content}</p>
            {conv.unread_count > 0 && (
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-purple-500 text-[10px] font-bold text-white shadow-sm shadow-violet-500/30">{conv.unread_count > 9 ? "9+" : conv.unread_count}</span>
            )}
          </div>
        )}
      </div>
    </m.button>
  );
}

/* ------------------------------------------------------------------ */
/*  ConversationList (main export)                                     */
/* ------------------------------------------------------------------ */

export function ConversationList({ conversations, activeId, currentUserId, onSelect, onNewChat, onDelete, deletingId }: ConversationListProps) {
  const [ctxConv, setCtxConv] = useState<ConversationItem | null>(null);
  const [ctxPos, setCtxPos] = useState({ x: 0, y: 0 });

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

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <h2 className="text-base font-bold tracking-tight">Chats</h2>
        <NewChatDialog onSelect={onNewChat} />
      </header>

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="relative">
              <div className="flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500/10 to-purple-600/10">
                <MessageCircle className="size-10 text-violet-400/50" />
              </div>
              <div className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/30">
                <Plus className="size-3 text-white" />
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold">No conversations yet</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">Tap the <strong>+</strong> button to start your first conversation.</p>
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {conversations.map((conv, i) => (
              <ConversationItemRow key={conv.id} conv={conv} activeId={activeId} currentUserId={currentUserId} onSelect={onSelect} onContextMenu={handleCtx} />
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
