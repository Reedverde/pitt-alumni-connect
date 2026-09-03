# Add the "First 2 weeks of October" seal to the hero, top right

## What
Place the uploaded starburst seal (gold metallic badge reading "FIRST 2 WEEKS OF OCTOBER, EVERY YEAR") in the top right corner of the board page hero, the Sabah Black section with the Archivo "Oct 2 to 4, 2026" headline.

## Files touched
- `src/assets/first-two-weeks-seal.png.asset.json` (new) — CDN asset pointer created with `lovable-assets create` from the uploaded image. No binary is copied into the repo.
- `src/routes/index.tsx` — Hero component only.

## Implementation
1. Create the asset pointer:
   ```sh
   lovable-assets create --file /mnt/user-uploads/Codex_Image_Sep_3_2026_12_03_39_PM.png --filename first-two-weeks-seal.png > src/assets/first-two-weeks-seal.png.asset.json
   ```
2. In `Hero` (src/routes/index.tsx, ~line 594): import the pointer and render an `<img>` absolutely positioned in the top right of the existing `relative` hero container, alongside the existing hero-peak photo:
   - `absolute top-0 right-0` inside the padded container, with a small inset so it clears the container edge.
   - Responsive size, roughly `clamp(90px, 13vw, 180px)` wide, square.
   - `z-10` so it sits above the Sabah Black background; the hero-peak photo stays at the bottom edge so they do not overlap on desktop. On narrow phones the badge shrinks with the clamp and stays clear of the headline.
   - Alt text: "First two weeks of October, every year".
   - No shadow, no rotation, no hover state. Flat placement, consistent with the design system.

## Guardrails checked
- The badge is a metallic gold sticker image, not the Pitt Gold token, and it carries no attending semantic. It renders as an image on the Sabah Black field only; no `var(--pitt-gold)` is used anywhere in this change.
- No copy, copy rules, or other sections change.

## Out of scope / note
- The requested `git checkout 6b3578cf... -- src/routes/index.tsx` plus commit cannot be run here: stateful git commands are blocked in this environment. Run it locally if that restore is still wanted; note it would overwrite the hero file this change edits, so do the restore first.
