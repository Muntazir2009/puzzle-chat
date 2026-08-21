"use client";

import React, { useCallback, useEffect, useRef, useState, memo } from "react";
import { m, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Sticker data                                                       */
/* ------------------------------------------------------------------ */

interface StickerCategory {
  id: string;
  label: string;
  icon: string;
  stickers: string[];
}

const STICKER_CATEGORIES: StickerCategory[] = [
  {
    id: "expressions",
    label: "Expressions",
    icon: "😄",
    stickers: [
      "😀","😃","😄","😁","😆","😅","🤣","😂","🙃","😉",
      "😊","😇","🥰","😍","🤩","😘","😋","😜","🤪","😝",
      "🤗","🤭","🫢","🤫","🤔","🤐","😏","😒","🙄","😬",
      "😌","🥲","😈","👻","💀","🤡","💩","🤖","👽","🫠",
    ],
  },
  {
    id: "hearts-love",
    label: "Love",
    icon: "❤️",
    stickers: [
      "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔",
      "❣️","💕","💞","💓","💗","💖","💘","💝",
      "💯","🔥","✨","⭐","🌟","💫","🌈","🦋","🌺","🌸",
    ],
  },
  {
    id: "hands",
    label: "Hands",
    icon: "👋",
    stickers: [
      "👋","🤚","✋","🖖","👌","🤌","🤏","✌️","🤞","🫰",
      "🤟","🤘","🤙","👈","👉","👆","👇","☝️","🫵","👍",
      "👎","✊","👊","🤛","🤜","👏","🙌","🫶","🤝","🙏",
      "💅","✍️","🤳","💪","🦾",
    ],
  },
  {
    id: "fun",
    label: "Fun",
    icon: "🎉",
    stickers: [
      "🎉","🎊","🎈","🎁","🎀","🏆","🥇","⚽","🎮","🎯",
      "🎲","🧩","🎪","🎭","🎨","🎬","🎤","🎧","🎵","🎶",
      "🎸","🎹","🥁","🎺","🎻","🪕","📸","📷",
    ],
  },
  {
    id: "food",
    label: "Food",
    icon: "🍕",
    stickers: [
      "🍕","🍔","🍟","🌮","🍣","🍦","🍩","🍪","🎂","🍰",
      "☕","🍷","🧋","🍺","🥤","🧃","🍫","🍬",
      "🍎","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍒","🍑",
    ],
  },
  {
    id: "nature",
    label: "Nature",
    icon: "🌸",
    stickers: [
      "🌸","💮","🌹","🥀","🌺","🌻","🌼","🌷","🍀","🍁",
      "🍂","🍃","🌿","🌱","🌲","🌊","☀️","🌙","⭐","🔥",
      "💧","🏔️","🏝️","🌋","🌴","🪻","💐","🪷","🌵",
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Category tab                                                       */
/* ------------------------------------------------------------------ */

const CategoryTab = memo(function CategoryTab({
  category, active, onClick,
}: { category: StickerCategory; active: boolean; onClick: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onClick(category.id)}
      className={"flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 whitespace-nowrap " + (active ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground")}
      style={active ? { background: "linear-gradient(135deg, var(--app-accent-subtle), rgba(255,255,255,0.04))" } : undefined}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))' }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      aria-label={category.label}
      aria-pressed={active}
    >
      <span className="text-sm leading-none">{category.icon}</span>
      <span className="hidden sm:inline">{category.label}</span>
    </button>
  );
});

/* ------------------------------------------------------------------ */
/*  Sticker cell                                                        */
/* ------------------------------------------------------------------ */

const StickerCell = memo(function StickerCell({ sticker, onSelect }: { sticker: string; onSelect: (s: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(sticker)}
      className="flex items-center justify-center rounded-2xl leading-none min-h-[52px] min-w-[52px] p-1.5 transition-all duration-150 hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2"
      style={{ "--tw-ring-color": "var(--app-accent-ring)" } as React.CSSProperties}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, var(--app-accent-subtle), rgba(255,255,255,0.04))'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      aria-label={`Sticker: ${sticker}`}
    >
      <span className="text-3xl" style={{ lineHeight: 1 }}>{sticker}</span>
    </button>
  );
});

/* ------------------------------------------------------------------ */
/*  StickerPicker                                                      */
/* ------------------------------------------------------------------ */

export interface StickerPickerProps {
  onSelect: (sticker: string) => void;
  children: React.ReactNode;
}

export function StickerPicker({ onSelect, children }: StickerPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(STICKER_CATEGORIES[0].id);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback(() => {
    setOpen((prev) => !prev);
    setActiveCategory(STICKER_CATEGORIES[0].id);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, close]);

  const handleSelect = useCallback((sticker: string) => {
    onSelect(sticker);
    close();
  }, [onSelect, close]);

  const cat = STICKER_CATEGORIES.find((c) => c.id === activeCategory);
  const stickers = cat?.stickers ?? [];

  return (
    <div ref={containerRef} className="relative inline-flex">
      <div onClick={toggle} className="cursor-pointer">
        {children}
      </div>

      <AnimatePresence>
        {open && (
          <m.div
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 8 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            style={{ transformOrigin: "bottom center", background: "linear-gradient(135deg, rgba(30,30,30,0.95), rgba(18,18,18,0.98))" }}
            className="absolute bottom-full right-0 z-50 mb-2 w-[320px] max-w-[85vw] overflow-hidden rounded-2xl border border-white/[0.08] backdrop-blur-2xl shadow-xl shadow-black/10"
            role="dialog"
            aria-label="Sticker picker"
          >
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Stickers</h3>
              <button
                type="button"
                onClick={close}
                className="flex size-6 items-center justify-center rounded-full text-white/40 transition-colors hover:text-white/80"
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                aria-label="Close sticker picker"
              >
                <X className="size-3" />
              </button>
            </div>

            <div className="flex gap-1 overflow-x-auto px-3 pb-2 scrollbar-none">
              {STICKER_CATEGORIES.map((c) => (
                <CategoryTab key={c.id} category={c} active={activeCategory === c.id} onClick={setActiveCategory} />
              ))}
            </div>

            <div className="mx-3 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)" }} />

            <div className="grid grid-cols-5 gap-0.5 p-2 max-h-60 overflow-y-auto scrollbar-thin">
              {stickers.map((s, i) => (
                <StickerCell key={`${s}-${i}`} sticker={s} onSelect={handleSelect} />
              ))}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
