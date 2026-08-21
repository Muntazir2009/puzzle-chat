"use client";

import { useState, useCallback, useRef } from "react";
import { Palette, ImagePlus, X, Upload } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Theme definitions                                                  */
/* ------------------------------------------------------------------ */

export type ChatBgThemeId =
  | "default"
  | "subtle-grid"
  | "geometric"
  | "gradient"
  | "dark-marble"
  | "starry-night"
  | "aurora";

export interface ChatBgTheme {
  id: ChatBgThemeId;
  label: string;
  style: React.CSSProperties;
  previewStyle: React.CSSProperties;
}

/*
 * Pattern colors now use the accent CSS vars so they automatically
 * follow the selected app theme (yellow, violet, crimson).
 * We use the var() syntax directly in the gradient strings.
 */

const themes: ChatBgTheme[] = [
  {
    id: "default",
    label: "Default",
    style: {},
    previewStyle: { backgroundColor: "hsl(var(--background))" },
  },

  {
    id: "subtle-grid",
    label: "Subtle Grid",
    style: {
      backgroundImage: [
        `radial-gradient(circle, var(--app-accent-subtle) 1px, transparent 1px)`,
      ].join(", "),
      backgroundSize: "24px 24px",
    },
    previewStyle: {
      backgroundColor: "hsl(var(--background))",
      backgroundImage: `radial-gradient(circle, var(--app-accent-pill-border) 1px, transparent 1px)`,
      backgroundSize: "8px 8px",
    },
  },

  {
    id: "geometric",
    label: "Geometric",
    style: {
      backgroundImage: [
        `repeating-linear-gradient(45deg, transparent, transparent 18px, var(--app-accent-subtle) 18px, var(--app-accent-subtle) 19px)`,
        `repeating-linear-gradient(-45deg, transparent, transparent 18px, var(--app-accent-subtle) 18px, var(--app-accent-subtle) 19px)`,
        `radial-gradient(circle, var(--app-accent-subtle) 1.5px, transparent 1.5px)`,
      ].join(", "),
      backgroundSize: "48px 48px, 48px 48px, 48px 48px",
      backgroundPosition: "0 0, 24px 24px, 24px 0",
    },
    previewStyle: {
      backgroundColor: "hsl(var(--background))",
      backgroundImage: [
        `repeating-linear-gradient(45deg, transparent, transparent 6px, var(--app-accent-pill-border) 6px, var(--app-accent-pill-border) 7px)`,
        `repeating-linear-gradient(-45deg, transparent, transparent 6px, var(--app-accent-pill-border) 6px, var(--app-accent-pill-border) 7px)`,
      ].join(", "),
      backgroundSize: "16px 16px, 16px 16px",
    },
  },

  {
    id: "gradient",
    label: "Gradient",
    style: {
      backgroundImage: [
        `linear-gradient(135deg, var(--app-accent-subtle) 0%, transparent 50%, var(--app-accent-subtle) 100%)`,
      ].join(", "),
    },
    previewStyle: {
      backgroundColor: "hsl(var(--background))",
      backgroundImage: "linear-gradient(135deg, var(--app-accent-pill-border) 0%, transparent 50%, var(--app-accent-pill-border) 100%)",
    },
  },

  {
    id: "dark-marble",
    label: "Dark Marble",
    style: {
      backgroundImage: [
        `radial-gradient(ellipse 60% 40% at 20% 30%, var(--app-accent-subtle) 0%, transparent 70%)`,
        `radial-gradient(ellipse 50% 60% at 75% 65%, var(--app-accent-subtle) 0%, transparent 70%)`,
        `radial-gradient(ellipse 40% 30% at 50% 90%, var(--app-accent-subtle) 0%, transparent 70%)`,
        `radial-gradient(ellipse 80% 20% at 10% 80%, var(--app-accent-subtle) 0%, transparent 70%)`,
      ].join(", "),
    },
    previewStyle: {
      backgroundColor: "hsl(var(--background))",
      backgroundImage: [
        `radial-gradient(ellipse 60% 40% at 25% 30%, var(--app-accent-pill-border) 0%, transparent 70%)`,
        `radial-gradient(ellipse 50% 60% at 75% 70%, var(--app-accent-pill-border) 0%, transparent 70%)`,
      ].join(", "),
    },
  },

  {
    id: "starry-night",
    label: "Starry Night",
    style: {
      backgroundImage: [
        `radial-gradient(circle 1.2px, var(--app-accent-subtle) 0.6px, transparent 0.6px)`,
        `radial-gradient(circle 1.2px, var(--app-accent-subtle) 0.6px, transparent 0.6px)`,
        `radial-gradient(circle 0.6px, var(--app-accent-subtle) 0.3px, transparent 0.3px)`,
        `radial-gradient(circle 0.6px, var(--app-accent-subtle) 0.3px, transparent 0.3px)`,
      ].join(", "),
      backgroundSize: "64px 64px, 64px 64px, 32px 32px, 32px 32px",
      backgroundPosition: "0 0, 32px 32px, 0 0, 16px 16px",
    },
    previewStyle: {
      backgroundColor: "hsl(var(--background))",
      backgroundImage: [
        `radial-gradient(circle 1px, var(--app-accent-pill-border) 0.5px, transparent 0.5px)`,
        `radial-gradient(circle 0.5px, var(--app-accent-pill-border) 0.3px, transparent 0.3px)`,
      ].join(", "),
      backgroundSize: "12px 12px, 8px 8px",
      backgroundPosition: "0 0, 4px 4px",
    },
  },

  {
    id: "aurora",
    label: "Aurora",
    style: {
      backgroundImage: [
        `radial-gradient(ellipse 100% 60% at 20% 100%, var(--app-accent-subtle) 0%, transparent 60%)`,
        `radial-gradient(ellipse 80% 50% at 60% 90%, var(--app-accent-subtle) 0%, transparent 60%)`,
        `radial-gradient(ellipse 120% 40% at 80% 100%, var(--app-accent-subtle) 0%, transparent 60%)`,
        `radial-gradient(ellipse 60% 80% at 40% 110%, var(--app-accent-subtle) 0%, transparent 60%)`,
      ].join(", "),
    },
    previewStyle: {
      backgroundColor: "hsl(var(--background))",
      backgroundImage: [
        `radial-gradient(ellipse 100% 60% at 20% 100%, var(--app-accent-pill-border) 0%, transparent 60%)`,
        `radial-gradient(ellipse 80% 50% at 70% 90%, var(--app-accent-pill-border) 0%, transparent 60%)`,
      ].join(", "),
    },
  },
];

/* ------------------------------------------------------------------ */
/*  Wallpaper presets                                                 */
/* ------------------------------------------------------------------ */

const WALLPAPER_PRESETS = [
  {
    id: "midnight",
    label: "Midnight",
    url: "",
    previewStyle: {
      background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0c0a09 100%)",
    },
    cssBackground: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0c0a09 100%)",
  },
  {
    id: "ember",
    label: "Ember",
    url: "",
    previewStyle: {
      background: "linear-gradient(135deg, #1c1917 0%, #451a03 50%, #1c1917 100%)",
    },
    cssBackground: "linear-gradient(135deg, #1c1917 0%, #451a03 50%, #1c1917 100%)",
  },
  {
    id: "forest",
    label: "Forest",
    url: "",
    previewStyle: {
      background: "linear-gradient(135deg, #052e16 0%, #14532d 50%, #052e16 100%)",
    },
    cssBackground: "linear-gradient(135deg, #052e16 0%, #14532d 50%, #052e16 100%)",
  },
];

/* ------------------------------------------------------------------ */
/*  Storage helpers                                                    */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "puzzle-chat-bg";
const WALLPAPER_STORAGE_KEY = "puzzle-chat-wallpaper";

function readStoredTheme(): ChatBgThemeId {
  if (typeof window === "undefined") return "default";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && themes.some((t) => t.id === raw)) return raw as ChatBgThemeId;
  } catch {}
  return "default";
}

function writeStoredTheme(id: ChatBgThemeId) {
  try { localStorage.setItem(STORAGE_KEY, id); } catch {}
}

function readStoredWallpaper(): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(WALLPAPER_STORAGE_KEY); } catch { return null; }
}

function writeStoredWallpaper(url: string | null) {
  try {
    if (url) localStorage.setItem(WALLPAPER_STORAGE_KEY, url);
    else localStorage.removeItem(WALLPAPER_STORAGE_KEY);
  } catch {}
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useChatBackground() {
  const [themeId, setThemeId] = useState<ChatBgThemeId>(() => readStoredTheme());
  const [wallpaper, setWallpaper] = useState<string | null>(() => readStoredWallpaper());

  const selectTheme = useCallback((id: ChatBgThemeId) => {
    setThemeId(id);
    writeStoredTheme(id);
  }, []);

  const setWallpaperAndStore = useCallback((url: string | null) => {
    setWallpaper(url);
    writeStoredWallpaper(url);
  }, []);

  const theme = themes.find((t) => t.id === themeId) ?? themes[0];

  return { themeId, theme, selectTheme, themes, wallpaper, setWallpaper: setWallpaperAndStore };
}

/* ------------------------------------------------------------------ */
/*  ChatBackgroundPicker                                               */
/* ------------------------------------------------------------------ */

interface ChatBackgroundPickerProps {
  themeId: ChatBgThemeId;
  onSelect: (id: ChatBgThemeId) => void;
  wallpaper: string | null;
  onSetWallpaper: (url: string | null) => void;
}

export function ChatBackgroundPicker({ themeId, onSelect, wallpaper, onSetWallpaper }: ChatBackgroundPickerProps) {
  const [open, setOpen] = useState(false);
  const [customUrlMode, setCustomUrlMode] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleApplyCustomUrl = useCallback(() => {
    const trimmed = customUrl.trim();
    if (trimmed) onSetWallpaper(trimmed);
    setCustomUrlMode(false);
    setCustomUrl("");
    setOpen(false);
  }, [customUrl, onSetWallpaper]);

  const handleClearWallpaper = useCallback(() => {
    onSetWallpaper(null);
    setCustomUrlMode(false);
    setCustomUrl("");
  }, [onSetWallpaper]);

  const handlePresetClick = useCallback((preset: (typeof WALLPAPER_PRESETS)[number]) => {
    onSetWallpaper(preset.cssBackground);
    setOpen(false);
  }, [onSetWallpaper]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      onSetWallpaper(dataUrl);
      setOpen(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, [onSetWallpaper]);

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex size-8 items-center justify-center rounded-full transition-colors duration-200",
              open
                ? "text-[var(--app-accent)]"
                : "text-white/60 hover:text-white",
              !open && "transition-all duration-200",
            )}
            style={open ? { backgroundColor: "var(--app-accent-subtle)" } : undefined}
            onMouseEnter={(e) => { if (!open) (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))' }}
            onMouseLeave={(e) => { if (!open) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            aria-label="Chat background theme"
          >
            <Palette className="size-4" />
          </button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl border-white/10 backdrop-blur-xl p-0"
          style={{ background: 'linear-gradient(180deg, rgba(30,30,30,0.98), rgba(15,15,15,0.99))' }}
        >
          <SheetHeader className="px-5 pt-5 pb-0">
            <SheetTitle className="text-base font-semibold text-white">
              Chat Background
            </SheetTitle>
          </SheetHeader>

          <div className="px-5 pb-8 pt-4 overflow-y-auto max-h-[60vh]">
            {/* Themes grid */}
            <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              Themes
            </p>
            <div className="grid grid-cols-4 gap-3">
              {themes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { onSelect(t.id); setOpen(false); }}
                  className="group relative flex flex-col items-center gap-1.5 outline-none"
                  title={t.label}
                  aria-label={t.label}
                  aria-pressed={t.id === themeId}
                >
                  <span
                    className={cn(
                      "size-12 rounded-xl border transition-all duration-200",
                      t.id === themeId
                        ? "ring-2 ring-[var(--app-accent)]"
                        : "hover:border-zinc-500",
                    )}
                    style={t.id === themeId
                      ? { ...t.previewStyle, borderColor: "var(--app-accent)" }
                      : { ...t.previewStyle, borderColor: "rgba(255,255,255,0.1)" }
                    }
                  />
                  <span className="text-[10px] text-zinc-500 group-hover:text-zinc-300 transition-colors">
                    {t.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Wallpaper section */}
            <div className="mt-5 border-t border-white/5 pt-4">
              <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                Wallpapers
              </p>
              <div className="flex items-center gap-3">
                {WALLPAPER_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handlePresetClick(preset)}
                    className="group relative flex flex-col items-center gap-1.5 outline-none"
                    title={preset.label}
                    aria-label={`Wallpaper: ${preset.label}`}
                  >
                    <span
                      className={cn(
                        "size-12 rounded-xl border transition-all duration-200",
                        wallpaper === preset.cssBackground
                          ? "ring-2 ring-[var(--app-accent)]"
                          : "hover:border-zinc-500",
                      )}
                      style={wallpaper === preset.cssBackground
                        ? { ...preset.previewStyle, borderColor: "var(--app-accent)" }
                        : { ...preset.previewStyle, borderColor: "rgba(255,255,255,0.1)" }
                      }
                    />
                    <span className="text-[10px] text-zinc-500 group-hover:text-zinc-300 transition-colors">
                      {preset.label}
                    </span>
                  </button>
                ))}

                {/* Custom URL button */}
                <button
                  type="button"
                  onClick={() => setCustomUrlMode(true)}
                  className={cn(
                    "flex size-12 items-center justify-center rounded-xl border transition-all duration-200 outline-none",
                    customUrlMode
                      ? "ring-2 ring-[var(--app-accent)]"
                      : "hover:border-zinc-500",
                  )}
                  style={customUrlMode
                    ? { borderColor: "var(--app-accent)", backgroundColor: "var(--app-accent-subtle)" }
                    : { borderColor: "rgba(255,255,255,0.1)" }
                  }
                  title="Custom URL"
                  aria-label="Set custom wallpaper URL"
                >
                  <ImagePlus className="size-4" style={{ color: customUrlMode ? "var(--app-accent)" : "rgb(161 161 170)" }} />
                </button>

                {/* Upload wallpaper button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex size-12 items-center justify-center rounded-xl border border-white/10 transition-all duration-200 outline-none hover:border-zinc-500"
                  title="Upload Wallpaper"
                  aria-label="Upload wallpaper image"
                >
                  <Upload className="size-4 text-zinc-500" />
                </button>
              </div>

              {wallpaper && (
                <button
                  type="button"
                  onClick={handleClearWallpaper}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/10 px-3 py-2 text-xs text-zinc-400 transition-all duration-200"
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <X className="size-3" />
                  Clear wallpaper
                </button>
              )}

              {customUrlMode && (
                <div className="mt-3 flex gap-2">
                  <input
                    type="url"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleApplyCustomUrl();
                      if (e.key === "Escape") { setCustomUrlMode(false); setCustomUrl(""); }
                    }}
                    placeholder="https://example.com/image.jpg"
                    className="flex-1 rounded-xl border border-white/10 bg-transparent px-3 py-2 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-[var(--app-accent)]"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleApplyCustomUrl}
                    className="rounded-xl px-4 py-2 text-xs font-medium text-black transition-opacity hover:opacity-80"
                    style={{ background: "linear-gradient(to right, var(--app-accent-from), var(--app-accent-to))" }}
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Hidden file input for wallpaper upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
        aria-hidden="true"
      />
    </>
  );
}
