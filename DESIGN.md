# Design System: Blockblast

## 1. Visual Theme & Atmosphere
This is a **Premium Web Game**, absolutely NOT a marketing landing page. The atmosphere balances the cozy warmth of a countryside dawn with the satisfying snappy mechanics of a premium modern mobile game. 
The UI is purposefully structured as a highly polished, interactive "Game Shell" widget floating over a dynamic `CountrysideBackdrop`. It must maintain this native-app, single-screen interactive feel.

## 2. Color Palette & Roles
- **Canvas/Backdrop Base** (#f5ecd7) — Primary warm background for UI elements.
- **Card Shell Base** (#fdf6ea) — The off-white background of the central game shell card.
- **Charcoal Ink** (#2a2418) — Primary text, deep depth, and heavy borders.
- **Muted Earth** (#8a7d65) — Secondary text, metadata, tooltips, and soft borders.
- **Vibrant Terracotta** (#e87432) — Primary accent for high scores, active states, and focus rings. 
- **Destructive Crimson** (#d4183d) — Error states or destructive actions.

## 3. Typography Rules
- **Display & Body:** `Be Vietnam Pro` — Friendly, highly legible sans-serif with rounded geometries.
- **Hierarchy:** Uses extreme weight contrasts (`font-black`, `font-extrabold` vs `font-medium`) rather than purely relying on size scaling.
- **Banned:** Generic serifs, thin weights for small labels, and un-styled system fonts.

## 4. Component Stylings
- **The Game Shell:** The core game is wrapped in `.blockblast-game-shell`. It uses `max-w-[440px]` on mobile and `lg:max-w-[1080px]` on desktop, with `rounded-[28px]`, `border-2`, and heavy drop shadows (`shadow-[0_18px_46px_...]`). This is the intended design! Do NOT strip this out.
- **Buttons:** Tactile, chunky interaction. They scale slightly (`gsap` bounce/back) rather than just changing color, offering a satisfying "push" mechanic.
- **HUD (Heads Up Display):** Stats use uppercase, heavily tracked labels with massive, tightly leaded numbers.
- **Blocks/Pieces:** Brightly colored with inner shadows and thick darker borders to pop off the board. No flat blocks.

## 5. Layout Principles
- **Single Screen Experience:** The game is a single, non-scrolling viewport (`h-[100dvh]`, `overflow-hidden`).
- **Responsive Shell:** On Desktop, a two-column split (`lg:flex-row`) inside the main shell. On Mobile, a vertical stack (`flex-col`) inside the shell.
- **Modals over Navigation:** Settings and Leaderboards act as modal/screen overlays replacing the game shell entirely, keeping the user immersed in the single-page app context.

## 6. Motion & Interaction
- **Perpetual Micro-Interactions:** The mascot breathes, scores pop with exaggerated spring physics.
- **Juicy Feedback:** Screen shakes, score cascades, and saturation changes upon game over or combo blasts.
- **Performance:** Hardware-accelerated transforms for UI pieces; PixiJS for the core game grid to guarantee 60fps+ on mobile browsers.

## 7. Anti-Patterns (Banned)
- **NO Landing Page Conversions:** Do not add marketing copy, scrolling hero sections, footers, or "call to action" blocks outside the game context. This is a game, not a product page.
- **DO NOT Break the Shell:** Do not remove the `blockblast-game-shell` boundaries, borders, or border-radius to make it "full bleed". The floating card layout is the intentional aesthetic.
- **NO Flat UI:** Do not use plain flat colors for blocks or containers. Everything interactive should have a slight border, inset shadow, or texture to feel touchable.
- **NO AI Copywriting Clichés:** Avoid generic placeholders. Use direct game terminology ("Tốt nhất", "Điểm").
