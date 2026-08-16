# Task 2-a: MessageFeed UI Overhaul

## Changes Applied

### Theme CSS Variables (replace all hardcoded violet/purple Tailwind classes)
Replaced ALL hardcoded `violet-*` and `purple-*` Tailwind color classes with inline styles using CSS custom properties:

- **ReceiptIcon**: `text-violet-400` → `style={{ color: 'var(--app-accent-light)' }}` for read status
- **EphemeralTimer**: `text-violet-300` → `style={{ color: 'var(--app-accent-lighter)' }}` on SVG circle
- **VoiceBubble**: `bg-violet-400` → inline style with `var(--app-accent-light)` for progress bars
- **LinkifiedText**: `decoration-violet-400/50` → `style={{ textDecorationColor: 'var(--app-accent-light)' }}`
- **ReplyPreview**: `border-l-violet-400/70 bg-violet-500/[0.08] text-violet-400` → inline styles with CSS vars
- **ReactionPills**: `border-violet-400/40 bg-violet-500/15 shadow-violet-500/20 text-violet-300` → inline styles
- **MessageBubble (AvatarFallback)**: `bg-gradient-to-br from-violet-100 to-purple-200 text-violet-700 dark:from-violet-500 dark:to-purple-600` → inline gradient with CSS vars
- **MessageBubble (own)**: `bg-gradient-to-r from-violet-500 to-purple-600 shadow-violet-500/15` → inline gradient/shadow
- **MessageBubble (received)**: `dark:shadow-violet-950/20` → `var(--app-accent-glow)`
- **TypingIndicator**: AvatarFallback gradient, `bg-violet-400` dots, `dark:shadow-violet-950/20` → CSS vars
- **MessageListSkeleton**: `bg-gradient-to-r from-violet-500/20 to-purple-600/20` → CSS var gradient
- **NewMessagesButton**: Full gradient background + shadow → CSS vars
- **EmptyState**: Glow ring, avatar ring, AvatarFallback gradient → CSS vars
- **Loading spinner**: `text-violet-400` → `var(--app-accent-light)`

### Task 1: Disable Native Text Selection
- Added `select-none` to outermost scrollable div (line with `overflow-y-auto`)
- Added `select-none` to each message bubble wrapper (`m.div` for outer row)
- Added `select-none` to the inner column div containing bubble + timestamp + reactions
- Added `touchCallout: 'none'` via inline style (with `as React.CSSProperties` cast) to the draggable bubble

### Task 2: Overhaul Swipe-to-Reply
- Removed `PanInfo` type import (no longer needed)
- Removed `SWIPE_REPLY_THRESHOLD` constant
- Removed `handleSwipeEnd` callback
- Replaced old drag setup (`dragConstraints={{ left: 0, right: 0 }}`, `dragElastic={{ left: 0, right: 0.35 }}`, `onDragEnd`) with new approach:
  - `dragConstraints={{ left: 0, right: 120 }}`
  - `dragElastic={0.3}`
  - `onDrag` handler: ignores leftward drag, shows reply arrow when offset > 30
  - `onDragEnd` handler: triggers reply when offset > 60
  - `transition={{ type: 'spring', stiffness: 500, damping: 35 }}` for spring snap-back
- Added `showReplyArrow` state (`useState`) inside MessageBubble
- Added reply arrow indicator: `m.div` with `Reply` icon, positioned absolutely (left for received, right for sent), with spring animation scaling from 0.5→1.2 and opacity 0→1, using `var(--app-accent)` circular background

### Task 3: Screen Edge Layout Spacing
- Changed message row outer padding: `px-4` → `px-1.5 sm:px-3`
- Added `mr-1.5 sm:mr-3` to sent message inner column
- Added `ml-1.5 sm:ml-3` to received message inner column
- Applied same padding change to DateSeparator (`px-1.5 sm:px-3`)
- Applied same padding change to TypingIndicator (`px-1.5 sm:px-3`)
- Applied same padding change to MessageListSkeleton (`px-1.5 sm:px-3`)

### Task 7: Message Bubble Polish

#### 7a: Bubble Corners
- Sent messages: `rounded-br-md` → `rounded-br-sm` (sharp bottom-right, origin side)
- Received messages: `rounded-bl-md` → `rounded-bl-sm` (sharp bottom-left, origin side)

#### 7b: Timestamp & Checkmarks (inline for text messages)
- For text messages: timestamp and ReceiptIcon moved INSIDE the bubble
- Wrapped in `flex items-end gap-1.5` layout with text content taking `flex-1 min-w-0`
- Timestamp: `text-[10px] leading-none mt-0.5 whitespace-nowrap` with `text-white/50` for own, `text-muted-foreground/60` for received
- ReceiptIcon: sized down to `size-3` with `opacity-60` (applied in component)
- For voice/image messages: timestamp stays below the bubble (now `text-[10px] text-muted-foreground/60`)
- Ephemeral timer shown inline with timestamp for text messages

#### 7c: Reaction Pills
- Added `relative -bottom-1 mt-[-6px]` to reactions container for overlap positioning
- Added `reaction-pop` class to each reaction pill button (in addition to existing animation)

## Files Modified
- `/home/z/my-project/src/components/chat/MessageFeed.tsx` (complete rewrite preserving all functionality)

## Verification
- TypeScript compilation: 0 errors for MessageFeed.tsx
- Dev server compiling successfully (confirmed via dev.log)
