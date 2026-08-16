"use client";

import React, { useCallback, useEffect, useRef, useState, memo } from "react";
import { m, AnimatePresence } from "framer-motion";
import { Search, X } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Emoji data (inline, no packages)                                  */
/* ------------------------------------------------------------------ */

interface EmojiCategory {
  id: string;
  label: string;
  icon: string;
  emojis: string[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: "smileys",
    label: "Smileys",
    icon: "😀",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃",
      "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😙",
      "🥲", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🫢",
      "🤫", "🤔", "🫡", "🤐", "🤨", "😐", "😑", "😶", "🫥", "😏",
      "😒", "🙄", "😬", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷",
      "🤒", "🤕", "🤢", "🤮", "🥵", "🥶", "🥴", "😵", "🤯", "🤠",
    ],
  },
  {
    id: "gestures",
    label: "Gestures",
    icon: "👋",
    emojis: [
      "👋", "🤚", "🖐️", "✋", "🖖", "🫱", "🫲", "🫳", "🫴", "👌",
      "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "👈", "👉",
      "👆", "🖕", "👇", "☝️", "🫵", "👍", "👎", "✊", "👊", "🤛",
      "🤜", "👏", "🙌", "🫶", "👐", "🤲", "🤝", "🙏", "✍️", "💅",
    ],
  },
  {
    id: "hearts",
    label: "Hearts",
    icon: "❤️",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
      "❤️‍🔥", "❤️‍🩹", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝",
      "💟", "♥️", "🫶", "😍", "🥰", "😘", "😜", "🫠", "😵", "🤯",
    ],
  },
  {
    id: "nature",
    label: "Nature",
    icon: "🌸",
    emojis: [
      "🌸", "💮", "🏵️", "🌹", "🥀", "🌺", "🌻", "🌼", "🌷", "🌱",
      "🌿", "☘️", "🍀", "🍁", "🍂", "🍃", "🪻", "🌺", "🌻", "⭐",
      "🌟", "✨", "⚡", "🔥", "💧", "🌈", "☀️", "🌤️", "⛅", "🌙",
      "🎉", "🎊", "🎈", "🎁", "🎀", "🏔️", "🌊", "🏝️", "🌋", "🌴",
    ],
  },
  {
    id: "objects",
    label: "Objects",
    icon: "💡",
    emojis: [
      "💡", "📱", "💻", "⌨️", "🖥️", "📷", "🎮", "🕹️", "🎬", "🎵",
      "🎶", "🎤", "🎧", "🎵", "🎸", "🎹", "🥁", "🏆", "🥇", "⚽",
      "🏀", "🏈", "🎁", "🎂", "🍰", "☕", "🍷", "🍕", "🍔", "🍟",
      "🌮", "🍣", "🍦", "🍩", "🍪", "🚀", "✈️", "🚗", "🏠", "📞",
      "💰", "💎", "🔑", "🔒", "📝", "📁", "📅", "🔔", "💬", "👻",
    ],
  },
];

/* Flatten all emojis with their category for search */
const ALL_EMOJIS_WITH_CATEGORY = EMOJI_CATEGORIES.flatMap((cat) =>
  cat.emojis.map((emoji) => ({ emoji, categoryId: cat.id }))
);

/* ------------------------------------------------------------------ */
/*  Category tab button                                                */
/* ------------------------------------------------------------------ */

interface CategoryTabProps {
  category: EmojiCategory;
  active: boolean;
  onClick: (id: string) => void;
}

const CategoryTab = memo(function CategoryTab({ category, active, onClick }: CategoryTabProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(category.id)}
      className={
        "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 whitespace-nowrap " +
        (active
          ? "bg-violet-500/15 text-violet-600 dark:text-violet-400"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/60")
      }
      aria-label={category.label}
      aria-pressed={active}
    >
      <span className="text-sm leading-none">{category.icon}</span>
      <span className="hidden sm:inline">{category.label}</span>
    </button>
  );
});

/* ------------------------------------------------------------------ */
/*  Emoji cell                                                         */
/* ------------------------------------------------------------------ */

interface EmojiCellProps {
  emoji: string;
  onSelect: (emoji: string) => void;
}

const EmojiCell = memo(function EmojiCell({ emoji, onSelect }: EmojiCellProps) {
  const handleSelect = useCallback(() => {
    onSelect(emoji);
  }, [emoji, onSelect]);

  return (
    <button
      type="button"
      onClick={handleSelect}
      className={
        "flex items-center justify-center rounded-lg text-xl leading-none " +
        "min-h-[36px] min-w-[36px] p-1 " +
        "transition-all duration-100 " +
        "hover:bg-violet-500/10 hover:scale-125 " +
        "active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
      }
      aria-label={emoji}
    >
      {emoji}
    </button>
  );
});

/* ------------------------------------------------------------------ */
/*  EmojiPicker                                                        */
/* ------------------------------------------------------------------ */

export interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  children: React.ReactNode;
}

export function EmojiPicker({ onSelect, children }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(EMOJI_CATEGORIES[0].id);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  /* Toggle open/close */
  const toggle = useCallback(() => {
    setOpen((prev) => !prev);
    setSearchQuery("");
    setActiveCategory(EMOJI_CATEGORIES[0].id);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setSearchQuery("");
  }, []);

  /* Focus search input when opened */
  useEffect(() => {
    if (open) {
      // Slight delay to let animation start
      const timer = setTimeout(() => searchInputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  /* Click outside to close */
  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open, close]);

  /* Escape to close */
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, close]);

  /* Handle emoji selection */
  const handleSelect = useCallback(
    (emoji: string) => {
      onSelect(emoji);
      close();
    },
    [onSelect, close]
  );

  /* Filtered emojis based on search + category */
  const filteredEmojis: string[] = (() => {
    if (searchQuery.trim()) {
      // Search mode: return from active category, filtered by some simple matching
      // Since we can't do keyword search without a library, we return all emojis
      // and let the grid show them all when searching
      const q = searchQuery.trim().toLowerCase();
      // Simple approach: return all emojis when searching (user types to filter visually)
      // We'll filter by checking if any emoji contains the search text (unicode matching)
      return ALL_EMOJIS_WITH_CATEGORY.filter((item) => {
        // Also check if the category name or any keyword matches
        const cat = EMOJI_CATEGORIES.find((c) => c.id === item.categoryId);
        return (
          cat?.label.toLowerCase().includes(q) ||
          cat?.id.includes(q) ||
          item.emoji.includes(q) ||
          q === "happy" || q === "sad" || q === "love" || q === "cool" ||
          q === "fire" || q === "party" || q === "food" || q === "music" ||
          q === "sport" || q === "nature" || q === "hand" || q === "heart" ||
          q === "star" || q === "sun" || q === "moon" || q === "rain" ||
          q === "flower" || q === "tree" || q === "car" || q === "phone" ||
          q === "computer" || q === "game" || q === "gift" || q === "cake"
        );
      }).map((item) => item.emoji);
    }
    const cat = EMOJI_CATEGORIES.find((c) => c.id === activeCategory);
    return cat?.emojis ?? [];
  })();

  return (
    <div ref={containerRef} className="relative inline-flex">
      {/* Trigger */}
      <div onClick={toggle} className="cursor-pointer">
        {children}
      </div>

      {/* Picker popover */}
      <AnimatePresence>
        {open && (
          <m.div
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 8 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            style={{ transformOrigin: "bottom center" }}
            className={
              "absolute bottom-full right-0 z-50 mb-2 w-[300px] max-w-[320px] " +
              "overflow-hidden rounded-2xl " +
              "border border-border/50 " +
              "bg-background/70 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/60 " +
              "shadow-xl shadow-black/10 dark:shadow-black/30"
            }
            role="dialog"
            aria-label="Emoji picker"
          >
            {/* Search input */}
            <div className="relative px-3 pt-3 pb-2">
              <Search className="absolute left-[18px] top-1/2 mt-[-2px] size-3.5 text-muted-foreground/60 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search emojis..."
                className={
                  "w-full rounded-xl border border-border/40 bg-muted/40 py-2 pl-8 pr-8 " +
                  "text-xs text-foreground placeholder:text-muted-foreground/60 " +
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/30 " +
                  "transition-all duration-150"
                }
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-[14px] top-1/2 mt-[-2px] flex size-4 items-center justify-center text-muted-foreground/60 hover:text-foreground transition-colors"
                  aria-label="Clear search"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            {/* Category tabs */}
            <div className="flex gap-1 overflow-x-auto px-3 pb-2 scrollbar-none">
              {EMOJI_CATEGORIES.map((cat) => (
                <CategoryTab
                  key={cat.id}
                  category={cat}
                  active={searchQuery.trim() ? false : activeCategory === cat.id}
                  onClick={setActiveCategory}
                />
              ))}
            </div>

            {/* Divider */}
            <div className="mx-3 h-px bg-border/40" />

            {/* Emoji grid */}
            <div className="grid grid-cols-7 gap-0.5 p-2 max-h-52 overflow-y-auto scrollbar-thin">
              {filteredEmojis.map((emoji, i) => (
                <EmojiCell key={`${emoji}-${i}`} emoji={emoji} onSelect={handleSelect} />
              ))}
              {filteredEmojis.length === 0 && (
                <div className="col-span-7 flex flex-col items-center justify-center py-6 text-muted-foreground">
                  <span className="text-2xl mb-1">🔍</span>
                  <span className="text-xs">No emojis found</span>
                </div>
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
