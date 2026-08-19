---
Task ID: 1
Agent: Main
Task: Fix black bars at top and bottom of chat view that hide content

Work Log:
- Analyzed user screenshot via VLM: identified solid black bar at top (above floating header) and thin dark bar at bottom
- Root cause: Near-black background (oklch(0.145 0 0)) visible in gaps between viewport edges and floating pill elements on notched phones
- No `viewport-fit=cover` was set, so web page didn't extend into safe areas (status bar, home indicator)
- No `env(safe-area-inset-*)` padding applied anywhere

Changes Made:
1. **layout.tsx**: Added Next.js `Viewport` export with `viewportFit: "cover"`; added `apple-mobile-web-app-capable` and `apple-mobile-web-app-status-bar-style` meta tags
2. **globals.css**: Added `env(safe-area-inset-*)` padding to `body` selector inside `@layer base`
3. **ChatLayout.tsx**:
   - Header: `sticky top-3` → `style={{ top: 'max(12px, env(safe-area-inset-top))' }}`
   - Feed area: `pb-24 pt-14` → dynamic calc with safe area insets
   - Input pill: `fixed bottom-4` → `style={{ bottom: 'max(16px, env(safe-area-inset-bottom))' }}`
   - Preview bars: `bottom: 72` → `calc(max(16px, env(safe-area-inset-bottom)) + 56px)`
4. **ChatView.tsx**:
   - NavPill: Adjusted vertical centering to account for safe areas
   - Back button: Added safe area top positioning
   - Settings page: Added safe area top padding
   - Branding header: Added safe area top padding

Stage Summary:
- Added viewport-fit=cover meta tag (confirmed in HTML output)
- All floating elements now respect safe area insets via env()
- Feed padding dynamically accounts for safe areas so messages never hide behind black zones
- Lint OOM (known issue with .open-next build artifacts, not code issue)
- Dev server compiles successfully
