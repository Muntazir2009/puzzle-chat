"use client";

import { useState, useCallback } from "react";
import { Palette, ImagePlus, X } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
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
  /** CSS properties for the full-size background (applied to the container) */
  style: React.CSSProperties;
  /** CSS properties for the 40×40 preview swatch */
  previewStyle: React.CSSProperties;
}

/*
 * All patterns use the accent palette and 3–8 % opacity so they
 * never interfere with message readability.
 *
 * Light-mode uses darker tints; dark-mode uses lighter tints.
 * We achieve dark-mode support by layering both tints – the one that
 * contrasts the current background will naturally show through.
 */

const VIOLET_LIGHT = "rgba(139, 92, 246, 0.05)";   // purple-500 @ 5%
const VIOLET_DARK = "rgba(196, 181, 253, 0.06)";    // violet-300 @ 6%

const themes: ChatBgTheme[] = [
  /* ---- Default --------------------------------------------------- */
  {
    id: "default",
    label: "Default",
    style: {},
    previewStyle: { backgroundColor: "hsl(var(--background))" },
  },

  /* ---- Subtle Grid (dot pattern) --------------------------------- */
  {
    id: "subtle-grid",
    label: "Subtle Grid",
    style: {
      backgroundImage: [
        `radial-gradient(circle, ${VIOLET_LIGHT} 1px, transparent 1px)`,
        `radial-gradient(circle, ${VIOLET_DARK} 1px, transparent 1px)`,
      ].join(", "),
      backgroundSize: "24px 24px, 24px 24px",
      backgroundPosition: "0 0, 12px 12px",
    },
    previewStyle: {
      backgroundColor: "hsl(var(--background))",
      backgroundImage: `radial-gradient(circle, rgba(139,92,246,0.3) 1px, transparent 1px)`,
      backgroundSize: "8px 8px",
    },
  },

  /* ---- Geometric (diagonal lines + circles) ---------------------- */
  {
    id: "geometric",
    label: "Geometric",
    style: {
      backgroundImage: [
        `repeating-linear-gradient(
          45deg,
          transparent,
          transparent 18px,
          ${VIOLET_LIGHT} 18px,
          ${VIOLET_LIGHT} 19px
        )`,
        `repeating-linear-gradient(
          -45deg,
          transparent,
          transparent 18px,
          ${VIOLET_DARK} 18px,
          ${VIOLET_DARK} 19px
        )`,
        `radial-gradient(circle, ${VIOLET_LIGHT} 1.5px, transparent 1.5px)`,
      ].join(", "),
      backgroundSize: "48px 48px, 48px 48px, 48px 48px",
      backgroundPosition: "0 0, 24px 24px, 24px 0",
    },
    previewStyle: {
      backgroundColor: "hsl(var(--background))",
      backgroundImage: [
        `repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(139,92,246,0.2) 6px, rgba(139,92,246,0.2) 7px)`,
        `repeating-linear-gradient(-45deg, transparent, transparent 6px, rgba(139,92,246,0.2) 6px, rgba(139,92,246,0.2) 7px)`,
      ].join(", "),
      backgroundSize: "16px 16px, 16px 16px",
    },
  },

  /* ---- Gradient (subtle corner-to-corner) ------------------------- */
  {
    id: "gradient",
    label: "Gradient",
    style: {
      backgroundImage: [
        `linear-gradient(135deg, ${VIOLET_LIGHT} 0%, transparent 50%, ${VIOLET_DARK} 100%)`,
      ].join(", "),
    },
    previewStyle: {
      backgroundColor: "hsl(var(--background))",
      backgroundImage: "linear-gradient(135deg, rgba(139,92,246,0.25) 0%, transparent 50%, rgba(139,92,246,0.15) 100%)",
    },
  },

  /* ---- Dark Marble ------------------------------------------------ */
  {
    id: "dark-marble",
    label: "Dark Marble",
    style: {
      backgroundImage: [
        /* wavy organic lines */
        `radial-gradient(ellipse 60% 40% at 20% 30%, ${VIOLET_LIGHT} 0%, transparent 70%)`,
        `radial-gradient(ellipse 50% 60% at 75% 65%, ${VIOLET_DARK} 0%, transparent 70%)`,
        `radial-gradient(ellipse 40% 30% at 50% 90%, ${VIOLET_LIGHT} 0%, transparent 70%)`,
        `radial-gradient(ellipse 80% 20% at 10% 80%, ${VIOLET_DARK} 0%, transparent 70%)`,
      ].join(", "),
    },
    previewStyle: {
      backgroundColor: "hsl(var(--background))",
      backgroundImage: [
        `radial-gradient(ellipse 60% 40% at 25% 30%, rgba(139,92,246,0.25) 0%, transparent 70%)`,
        `radial-gradient(ellipse 50% 60% at 75% 70%, rgba(139,92,246,0.2) 0%, transparent 70%)`,
      ].join(", "),
    },
  },

  /* ---- Starry Night ---------------------------------------------- */
  {
    id: "starry-night",
    label: "Starry Night",
    style: {
      backgroundImage: [
        /* large faint stars */
        `radial-gradient(circle 1.2px, ${VIOLET_LIGHT} 0.6px, transparent 0.6px)`,
        `radial-gradient(circle 1.2px, ${VIOLET_DARK} 0.6px, transparent 0.6px)`,
        /* tiny star field */
        `radial-gradient(circle 0.6px, rgba(139,92,246,0.08) 0.3px, transparent 0.3px)`,
        `radial-gradient(circle 0.6px, rgba(196,181,253,0.08) 0.3px, transparent 0.3px)`,
      ].join(", "),
      backgroundSize: [
        "64px 64px",
        "64px 64px",
        "32px 32px",
        "32px 32px",
      ].join(", "),
      backgroundPosition: [
        "0 0",
        "32px 32px",
        "0 0",
        "16px 16px",
      ].join(", "),
    },
    previewStyle: {
      backgroundColor: "hsl(var(--background))",
      backgroundImage: [
        `radial-gradient(circle 1px, rgba(139,92,246,0.5) 0.5px, transparent 0.5px)`,
        `radial-gradient(circle 0.5px, rgba(139,92,246,0.4) 0.3px, transparent 0.3px)`,
      ].join(", "),
      backgroundSize: "12px 12px, 8px 8px",
      backgroundPosition: "0 0, 4px 4px",
    },
  },

  /* ---- Aurora ---------------------------------------------------- */
  {
    id: "aurora",
    label: "Aurora",
    style: {
      backgroundImage: [
        /* soft flowing wave layers */
        `radial-gradient(ellipse 100% 60% at 20% 100%, rgba(139,92,246,0.06) 0%, transparent 60%)`,
        `radial-gradient(ellipse 80% 50% at 60% 90%, rgba(168,85,247,0.05) 0%, transparent 60%)`,
        `radial-gradient(ellipse 120% 40% at 80% 100%, rgba(196,181,253,0.04) 0%, transparent 60%)`,
        `radial-gradient(ellipse 60% 80% at 40% 110%, rgba(139,92,246,0.03) 0%, transparent 60%)`,
      ].join(", "),
    },
    previewStyle: {
      backgroundColor: "hsl(var(--background))",
      backgroundImage: [
        `radial-gradient(ellipse 100% 60% at 20% 100%, rgba(139,92,246,0.3) 0%, transparent 60%)`,
        `radial-gradient(ellipse 80% 50% at 70% 90%, rgba(168,85,247,0.25) 0%, transparent 60%)`,
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
  } catch { /* ignore */ }
  return "default";
}

function writeStoredTheme(id: ChatBgThemeId) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch { /* ignore */ }
}

function readStoredWallpaper(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(WALLPAPER_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredWallpaper(url: string | null) {
  try {
    if (url) {
      localStorage.setItem(WALLPAPER_STORAGE_KEY, url);
    } else {
      localStorage.removeItem(WALLPAPER_STORAGE_KEY);
    }
  } catch { /* ignore */ }
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

  const handleApplyCustomUrl = useCallback(() => {
    const trimmed = customUrl.trim();
    if (trimmed) {
      onSetWallpaper(trimmed);
    }
    setCustomUrlMode(false);
    setCustomUrl("");
    setOpen(false);
  }, [customUrl, onSetWallpaper]);

  const handleClearWallpaper = useCallback(() => {
    onSetWallpaper(null);
    setCustomUrlMode(false);
    setCustomUrl("");
  }, [onSetWallpaper]);

  const handlePresetClick = useCallback((preset: typeof WALLPAPER_PRESETS[number]) => {
    onSetWallpaper(preset.cssBackground);
    setOpen(false);
  }, [onSetWallpaper]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex size-9 items-center justify-center rounded-lg transition-colors",
            open
              ? "text-[var(--app-accent)]"
              : "text-muted-foreground hover:bg-muted",
          )}
          style={open ? { backgroundColor: "var(--app-accent-subtle)" } : undefined}
          aria-label="Chat background theme"
        >
          <Palette className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        className="w-auto p-3"
      >
        <p className="mb-2.5 px-1 text-xs font-medium text-muted-foreground">
          Chat Background
        </p>
        <div className="grid grid-cols-4 gap-2">
          {themes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                onSelect(t.id);
                setOpen(false);
              }}
              className={cn(
                "group relative flex size-10 items-center justify-center rounded-lg transition-all outline-none",
              )}
              title={t.label}
              aria-label={t.label}
              aria-pressed={t.id === themeId}
            >
              {/* Swatch */}
              <span
                className={cn(
                  "size-full rounded-lg border",
                  t.id === themeId
                    ? "ring-2"
                    : "hover:border-muted-foreground/40",
                )}
                style={t.id === themeId
                  ? { ...t.previewStyle, borderColor: "var(--app-accent)", boxShadow: `0 0 0 2px var(--app-accent-ring)` }
                  : { ...t.previewStyle, borderColor: "hsl(var(--border))" }
                }
              />
              {/* Label on hover (tooltip-like) */}
              <span className="pointer-events-none absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                {t.label}
              </span>
            </button>
          ))}
        </div>

        {/* Wallpaper section */}
        <div className="mt-4 border-t pt-3">
          <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">
            Wallpapers
          </p>
          <div className="flex items-center gap-2">
            {WALLPAPER_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePresetClick(preset)}
                className={cn(
                  "group relative flex size-10 items-center justify-center rounded-lg transition-all outline-none",
                )}
                title={preset.label}
                aria-label={`Wallpaper: ${preset.label}`}
              >
                <span
                  className={cn(
                    "size-full rounded-lg border",
                    wallpaper === preset.cssBackground
                      ? "ring-2"
                      : "hover:border-muted-foreground/40",
                  )}
                  style={wallpaper === preset.cssBackground
                    ? { ...preset.previewStyle, borderColor: "var(--app-accent)", boxShadow: `0 0 0 2px var(--app-accent-ring)` }
                    : { ...preset.previewStyle, borderColor: "hsl(var(--border))" }
                  }
                />
                <span className="pointer-events-none absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  {preset.label}
                </span>
              </button>
            ))}

            {/* Custom URL button */}
            <button
              type="button"
              onClick={() => setCustomUrlMode(true)}
              className={cn(
                "flex size-10 items-center justify-center rounded-lg border transition-all outline-none",
                customUrlMode
                  ? "ring-2"
                  : "hover:border-muted-foreground/40",
              )}
              style={customUrlMode
                ? { borderColor: "var(--app-accent)", boxShadow: `0 0 0 2px var(--app-accent-ring)`, backgroundColor: "var(--app-accent-subtle)" }
                : { borderColor: "hsl(var(--border))" }
              }
              title="Custom URL"
              aria-label="Set custom wallpaper URL"
            >
              <ImagePlus className="size-4" style={{ color: customUrlMode ? "var(--app-accent)" : undefined }} />
            </button>
          </div>

          {/* Clear wallpaper button */}
          {wallpaper && (
            <button
              type="button"
              onClick={handleClearWallpaper}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
            >
              <X className="size-3" />
              Clear wallpaper
            </button>
          )}

          {/* Custom URL input */}
          {customUrlMode && (
            <div className="mt-2 flex gap-2">
              <input
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleApplyCustomUrl();
                  if (e.key === "Escape") { setCustomUrlMode(false); setCustomUrl(""); }
                }}
                placeholder="https://example.com/image.jpg"
                className="flex-1 rounded-lg border bg-transparent px-3 py-1.5 text-xs outline-none placeholder:text-muted-foreground/50 focus:border-[var(--app-accent)]"
                autoFocus
              />
              <button
                type="button"
                onClick={handleApplyCustomUrl}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-80"
                style={{ background: "linear-gradient(to right, var(--app-accent-from), var(--app-accent-to))" }}
              >
                Apply
              </button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
