# Task 2-b: MessageFeed Gesture System & Animation Rewrite

**Agent:** Frontend Engineer
**Status:** Completed

## Work Log

### 1. Gesture System Overhaul
- **Removed** `HeartBurst` component entirely (double-tap-to-heart behavior)
- **Removed** `DOUBLE_TAP_MS` constant (no longer needed)
- **Created** `MessageActionSheet` component: a floating dark panel (`bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl`) with horizontal row of icon buttons (Reply, Copy, Delete [own only, red], Forward). Positioned `bottom-full mb-2 left-1/2 -translate-x-1/2` relative to bubble. Entrance animation: `duration: 0.15` with scale 0.95→1. Border uses `var(--app-accent-subtle)`, icon hover color uses `var(--app-accent)`.
- **Single tap** now toggles the `MessageActionSheet` (not TapbackDock, not heart). Added `wasDraggedRef` to suppress action sheet after swipe-to-reply drags.
- **Long press** opens TapbackDock with emoji reactions. Changed TapbackDock position from `-bottom-12` to `-top-12` (now floats ABOVE the bubble).
- **Swipe to reply**: kept drag="x" behavior, replaced spring transition with `duration: 0.2, ease: "easeOut"`. Used `dragTransition` prop to separate drag snap-back from entrance animation. Reply arrow indicator uses same eased transition.

### 2. Unicode/Emoji Rendering
- Verified `REACTION_EMOJIS` array uses unicode escapes that render correctly in JSX/browser. No changes needed.
- ReactionPills display emoji + count properly. Active pills use `var(--app-accent)` border and `var(--app-accent-subtle)` bg.

### 3. Animation Refinement
- **All** `type: "spring"` transitions replaced with `duration` + `ease: "easeOut"`:
  - TapbackDock entrance: `duration: 0.15, ease: "easeOut"`
  - TapbackDock "more" submenu: `duration: 0.15, ease: "easeOut"`
  - Bubble drag snap-back: `dragTransition={{ duration: 0.2, ease: "easeOut" }}`
  - Reply arrow indicator: `duration: 0.2, ease: "easeOut"`
  - ImageLightbox (overlay + image zoom): `duration: 0.15, ease: "easeOut"`
  - NewMessagesButton: `duration: 0.15, ease: "easeOut"`
  - TypingIndicator: `duration: 0.15`
- **Replaced** `active:scale-[0.98]` on bubble with `active:scale-95`; added `active:scale-95` to all interactive buttons.
- **Removed** `md:hover:-translate-y-0.5` hover lift on text/image bubbles — now just `md:hover:shadow-md`.
- **Removed** EmptyState avatar pulse animation (`animate={{ scale: [1, 1.02, 1] }}`) — avatar is now static.
- **Kept** MessageBubble entrance: `duration: 0.3, ease: [0.22, 1, 0.36, 1]`.

### 4. Theme Variable Propagation
- VoiceBubble play button: non-own hover changed to `hover:bg-[var(--app-accent-subtle)]`.
- VoiceBubble progress bars: non-own played bars use `var(--app-accent-light)` (already done).
- ReactionPills active state: non-own border changed to `var(--app-accent)`, bg to `var(--app-accent-subtle)`.
- MessageActionSheet: border `var(--app-accent-subtle)`, icon hover `var(--app-accent)`.
- DateSeparator: ring changed to `ring-[var(--app-accent-subtle)]`.
- TypingIndicator bubble: `shadow-[0_1px_2px_0_var(--app-accent-glow)]` (already done).
- TypingIndicator dots: `var(--app-accent-light)` (already done).
- Skeleton loading: `var(--app-accent-glow)` gradient (already done).
- EmptyState: all `var(--app-accent-*)` references verified correct.

### 5. Message Bubble Polish
- Reaction pills container: changed from `relative -bottom-1 mt-[-6px]` to `relative -mt-1.5` for cleaner overlap.
- Border radii: kept `rounded-2xl` with sharp origin-side corners.
- Timestamp + checkmarks: kept inline bottom-right for text messages.

### 6. Misc
- All kept unchanged: `LinkifiedText`, `highlightText`, `parseUrls`, `ReplyPreview`, `ImageLightbox`, `VoiceBubble` (with theme fixes), `DateSeparator` (with theme fixes), `TypingIndicator` (with animation fixes), `MessageListSkeleton`, `NewMessagesButton`, `EmptyState` (with fixes).
- `useVirtualizer` logic in `MessageFeed` unchanged.
- All props interfaces unchanged.
- Added `currentUserId` prop to internal `MessageBubble` component to pass real user ID to `ReactionPills` (was hardcoded to `""`).

### ESLint Result
- 0 errors, 1 pre-existing warning about `useVirtualizer` incompatible with React Compiler memoization (cannot be fixed).
