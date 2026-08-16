# Task 2-b: Theme Engine + Search Removal + Wallpaper

## Summary

Executed 3 tasks: search removal, wallpaper support, and theme engine.

---

### TASK 4: Remove Search Functionality

**ChatLayout.tsx:**
- Removed `Search` and `Loader2` icons from imports (Loader2 kept — still used elsewhere)
- Removed `SearchPanel` component (entire function, ~125 lines)
- Removed `searchOpen`, `searchHighlight`, `scrollToMessageId` state variables
- Removed `handleSearchResultClick`, `handleClearSearchHighlight`, `handleScrolledToMessage` callbacks
- Removed `searchOpen` from global keyboard shortcut handler and dependency array
- Removed `searchHighlight` reference in `handleInputChange` callback
- Removed Search button from header (the toggle button with Search icon)
- Removed `<AnimatePresence>` block rendering `<SearchPanel>`
- Removed `scrollToMessageId`, `onScrolledToMessage`, `searchHighlight`, `onClearSearchHighlight` props from `<MessageFeed>`

**ConversationList.tsx:**
- Removed conversation filter/search input section (the div with "Filter chats..." input)
- Removed `filter` state variable
- Removed `filteredConversations` memo
- Replaced all `filteredConversations` usage with `conversations` directly
- Removed the "No matching conversations" empty state (only total empty state remains)
- Kept `Search` icon import (used in NewChatDialog empty state illustrations)
- Removed `useMemo` import for `filteredConversations` (still used for `partnerIds` and `LinkifiedText`)

---

### TASK 5: Custom Wallpaper Support

**ChatBackgroundPicker.tsx:**
- Added `WALLPAPER_STORAGE_KEY = "puzzle-chat-wallpaper"` constant
- Added `readStoredWallpaper()` and `writeStoredWallpaper()` functions
- Added `ImagePlus` and `X` icon imports from lucide-react
- Added `WALLPAPER_PRESETS` array with 3 presets: "Midnight" (dark blue-black gradient), "Ember" (warm dark red/orange), "Forest" (dark green)
- Extended `useChatBackground` hook to include `wallpaper` state and `setWallpaper` function
- Added wallpaper section to `ChatBackgroundPicker` component:
  - 3 preset texture swatches with preview styles
  - Custom URL button that opens inline input
  - Clear wallpaper button when a wallpaper is active
  - URL input with Enter/Escape key handling and Apply button
- Updated `ChatBackgroundPickerProps` interface to include `wallpaper` and `onSetWallpaper`
- Replaced hardcoded `violet-*` classes in picker button active state with CSS variable styles

**ChatLayout.tsx:**
- Destructured `wallpaper` and `setWallpaper` from `useChatBackground()` hook
- Computed `bgStyle` — when `wallpaper` is set, overrides theme style with `{ backgroundImage, backgroundSize: 'cover', backgroundPosition: 'center' }`
- Passed `bgStyle` to `MessageFeed` as `backgroundStyle` prop
- Passed `wallpaper` and `onSetWallpaper` to `ChatBackgroundPicker`

---

### TASK 6: Golden/Amber & Crimson Theme Engine

**6a: Created `/src/lib/theme-context.tsx`**
- Defined `AppTheme` type: `"default" | "golden" | "crimson"`
- Created `ThemeContext` with provider pattern
- `ThemeProvider` component: reads stored theme on mount, sets `data-theme` attribute on `<html>`, persists to `localStorage`
- `useAppTheme()` hook for consuming theme context
- Storage key: `"puzzle-app-theme"`

**6b: Added CSS variables to `globals.css`**
- Added theme variable blocks for `:root/[data-theme="default"]`, `[data-theme="golden"]`, `[data-theme="crimson"]`
- Variables per theme: `--app-accent-from`, `--app-accent-to`, `--app-accent`, `--app-accent-light`, `--app-accent-lighter`, `--app-accent-dark`, `--app-accent-ring`, `--app-accent-glow`, `--app-accent-subtle`, `--app-accent-text`
- Default (violet): `#8b5cf6` / `#9333ea`
- Golden (amber): `#f59e0b` / `#d97706`
- Crimson (rose): `#e11d48` / `#b91c1c`
- Added smooth transition rule for `[data-theme] *` elements
- Added `.conversation-item-row` CSS class with hover/active states using CSS variables

**6c: Modified ChatView.tsx**
- Imported `ThemeProvider`, `useAppTheme`, and `AppTheme` from theme-context
- Wrapped entire return JSX in `<ThemeProvider>`
- Added `useAppTheme()` call in ChatView body (returns defaults since outside Provider, suppressed with void)
- Created `ThemeSelector` component with 3 colored circles (Violet, Golden, Crimson)
- Added `ThemeSelector` to user menu dropdown between user info and ProfileDialog
- Replaced all hardcoded violet/purple in ChatView with CSS variable styles:
  - PuzzleLogo gradient, shadow, ring
  - User avatar gradient, ring
  - Empty state gradient, icon color

**6d: Replaced hardcoded violet/purple in ChatLayout.tsx**
- Header avatar: gradient fallback, ring colors → CSS variables
- Typing indicator: `text-violet-500` → `var(--app-accent)`
- Reply preview bar: background, border, gradient bar, sender name color → CSS variables
- Attachment preview: background, border, icon colors, upload spinner → CSS variables
- Voice waveform bars: `bg-violet-500/70` → CSS variable
- Voice send button: gradient → CSS variables
- Vanish toggle: active background/color/shadow → CSS variables
- Ephemeral dropdown items: active background/color → CSS variables
- Send button: gradient, shadow → CSS variables
- Attachment button active state → CSS variables
- PartnerInfoPanel: avatar ring, gradient fallback → CSS variables
- Removed all `violet-*`, `purple-*` Tailwind classes from ChatLayout.tsx

**6e: Replaced hardcoded violet/purple in ConversationList.tsx**
- New chat button: gradient, shadow → CSS variables
- Link underlines: `decoration-violet-400/50` → CSS variables with hover handler
- Conversation item row: hover/active border and background → `.conversation-item-row` CSS class
- Avatar fallback gradient → CSS variables
- Pin icon: `text-violet-400` → CSS variable
- Unread timestamp: `text-violet-500` → CSS variable
- Unread badge: gradient, shadow → CSS variables
- Empty state: background circle, icon color → CSS variables
- Floating `+` badge: gradient, shadow → CSS variables
- Strong `+` text: `text-violet-500` → CSS variable
- Removed all `violet-*`, `purple-*` Tailwind classes from ConversationList.tsx
