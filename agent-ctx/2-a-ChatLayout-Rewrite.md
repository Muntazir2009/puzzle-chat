# Task 2-a: ChatLayout.tsx Complete Rewrite

## Summary
Complete rewrite of `/src/components/chat/ChatLayout.tsx` (722→789 lines) implementing all 7 required changes.

## Changes Applied

### 1. Floating Glassmorphic Input Pill
- Moved entire input area to a `fixed bottom-4 left-4 right-4 max-w-2xl mx-auto z-30` container
- Applied `rounded-full` pill shape with glassmorphic styling: `bg-white/80 dark:bg-neutral-900/80`, `border border-black/5 dark:border-[var(--app-accent-subtle)]`, `backdrop-blur-md shadow-2xl`
- Internal layout: Paperclip + Emoji icons on LEFT, transparent `bg-transparent` textarea in MIDDLE, Send/Mic on RIGHT — all on one horizontal line
- Removed vanish mode toggle and ephemeral timer dropdown from the input pill
- Added `pb-28` to the message feed container div to prevent messages from being covered by the floating pill

### 2. Voice Note Upload to Supabase Storage
- Replaced `sendMessage(url, { type: 'voice', ... })` with proper upload flow
- `handleVoiceSend` now: stops recording → creates FormData with `file`, `conversation_id`, `voice_duration`, `waveform_data`, `ephemeral_seconds` → POSTs to `/api/messages/voice` → shows toast on failure
- Added `isSendingVoice` state for loading indicator on the voice send button
- Message is created server-side and broadcast via realtime (no client-side sendMessage call)

### 3. Reply Preview and Attachment Preview
- Moved both preview bars above the floating pill as fixed-positioned elements
- Container positioned at `fixed left-4 right-4 max-w-2xl mx-auto z-30` with `style={{ bottom: 80 }}`
- Attachment preview stacks above reply preview when both are present
- Kept same visual style (accent border, gradient bar, etc.) but with `rounded-2xl`

### 4. Voice Waveform Overlay
- Waveform now renders INSIDE the pill shape, replacing the textarea during recording
- Red recording dot, waveform bars (reduced to 40 bars, 32px max height), timer, and send/cancel buttons all within the pill
- Voice send and cancel buttons use `rounded-full` to match pill shape

### 5. Animation Refinement
- Removed ALL spring-based framer-motion transitions (`type: "spring"`)
- Replaced with `duration: 0.15` or `duration: 0.2` with `ease: "easeOut"`
- Removed all `whileTap={{ scale: 0.9 }}` and `whileTap={{ scale: 0.85 }}` — replaced with `active:scale-95` CSS class
- Send button entrance: `duration: 0.15, ease: "easeOut"`
- Mic button entrance: `duration: 0.15, ease: "easeOut"`
- Reply preview animate/exit: `duration: 0.15, ease: "easeOut"`
- Attachment preview animate/exit: `duration: 0.15, ease: "easeOut"`
- PartnerInfoPanel slide-in: `duration: 0.2, ease: "easeOut"`

### 6. Theme Variable Sync
- Header border: `border-[var(--app-accent-subtle)]` (was `border-border/40`)
- Header backdrop: `bg-background/80` with `backdrop-blur-2xl supports-[backdrop-filter]:bg-background/60`
- Avatar rings: `ring-[var(--app-accent-lighter)]/30` (in both header and PartnerInfoPanel)
- Pill border: `border-black/5 dark:border-[var(--app-accent-subtle)]` with `focus-within:border-[var(--app-accent-light)]` transition
- Pill glow on focus-within: `focus-within:shadow-[0_0_20px_var(--app-accent-glow)]`
- Send button: gradient `linear-gradient(to right, var(--app-accent-from), var(--app-accent-to))`

### 7. Hidden File Input
- Kept as-is, moved to root level of the component (sibling to other fixed elements)

### Cleanup
- Removed unused imports: `EyeOff`, `Eye`, `Clock`, `formatDistanceToNow`
- Removed `EPHEMERAL_OPTIONS` constant (no longer used in UI)
- Removed `ephemeralOpen` state (dropdown UI removed)
- Removed unused `setVanishMode` and `setEphemeralSeconds` setters from state destructuring
- Removed unused eslint-disable comment for `@next/next/no-img-element`
- Removed unnecessary JS comment from `cn()` call

### TDZ Ordering (Maintained)
- `hasAttachment`, `hasText` → `clearAttachment` → `uploadAttachment` → `handleSubmit` → `handleVoiceSend` → `handleVoiceCancel` → `handleKeyDown` → `handleInputChange` → `handleInput` → `canSend` → `handleFileSelect` → `handlePaperclipClick`

## Verification
- ESLint: 0 errors, 0 warnings
- TypeScript (`tsc --noEmit`): 0 errors
- Dev server: Compiles and serves successfully (200 OK on routes)

## Files Modified
- `/src/components/chat/ChatLayout.tsx` — Complete rewrite
