# Donate page, footer give links, admin QR panel

## What the inventory found

- **No floating donate button exists.** No reference to `pittsburghfoundation.org` anywhere in `src/`, and no donate button or link besides the footer. The idea from earlier today was never built.
- **One endowment reference exists:** `src/components/SiteFooter.tsx:43-51` links "Endowment" directly out to `https://www.esnultimate.org/endowment/` (the old esnultimate.org page), styled in Pitt Royal alongside "Board | Weekend | Alumni | Discord | Site by everde.co". Note: the footer "Weekend" label also still says Weekend while pointing at /schedule, worth aligning to "Schedule" in the same pass.
- **QR pattern exists:** `qrcode.react` (^4.2.0) is already a dependency, used in `src/routes/qr.tsx` via `QRCodeSVG` with `level="H"`, black on white, inside the `.qr-*` print poster styles in `src/styles.css`. No new library needed.
- No sitemap file; routes use their own `head()` metadata.

## Plan

### 1. New route `/donate` (`src/routes/donate.tsx`)

Public page, one H1, own `head()` (title "Donate | Pitt Club Ultimate Alumni", description, og:title, og:description, og:type, twitter:card). Three options presented as equal cards in a single row/grid, no ranking, no gold styling on any one:

1. **Pittsburgh Foundation endowment fund** -> `https://pittsburghfoundation.org/fundsearch?form=donate&q=Endowment%20for%20Pitt%20Ultimate&designationId=EYVXEKTZ&modifyDesignation=no`
2. **PayPal** -> `https://paypal.me/williambrotman`
3. **Venmo** -> `https://venmo.com/William-Brotman`

PayPal and Venmo cards each carry a small transparency note: these go to Brody Brotman personally, not to a program or organization account, and should not be assumed tax deductible or club-handled. The Foundation card notes it is the official endowment fund. Design system rules apply: no gold as decoration, no gradients, Space Grotesk body, Archivo only for the heading, plain outbound links in Pitt Royal.

### 2. Footer (`src/components/SiteFooter.tsx`)

Replace the direct external "Endowment" link with three internal `Link` entries that all point to `/donate`:

- "Endowment" -> `/donate` (with a hash or query anchor to the Foundation card if practical, e.g. `/donate#endowment`)
- "PayPal" -> `/donate#paypal`
- "Venmo" -> `/donate#venmo`

This gives one canonical page instead of raw links scattered around, matching the existing footer `Link` pattern (label-caps, steel-ink/royal colors). The old esnultimate.org endowment link is removed. Also fix the footer "Weekend" label to "Schedule" while here.

### 3. Admin QR panel (`src/components/admin/Panels.tsx` + `src/routes/_authenticated/admin.tsx`)

New `DonateQrPanel` in `Panels.tsx`, following the existing `Section`/`Num`/`cellStyle`/`hairline` conventions. It renders three `QRCodeSVG` codes (reusing the pattern from `src/routes/qr.tsx`, level H, black on white), one per donation URL, each labeled with its destination. No data fetch needed (URLs are static constants), so no change to `admin.server.ts`. Placed in the Schedule tab below `EventHeadcountPanel`, since that is where organizers already look for event-day numbers, alongside the existing QR-poster concept for in-person use.

Constants for the three URLs live in one place (`src/lib/donate.ts` or added to `src/lib/site-url.ts`) so the route, footer, and QR panel share them.

### 4. Verification

- Typecheck + build green.
- Playwright: `/donate` renders all three options with the transparency note, footer links resolve to `/donate`, admin Schedule tab shows three scannable QR codes.
- Update `PROJECT_STATE.md` with the new route and the esnultimate.org endowment link removal.

## Copy notes

- No em dashes, no hyphens as punctuation.
- Gold #FFB81C is not used anywhere on this page; donate has no attending meaning.
- No "Sign up" language; this page is outbound links only.

## Technical details

- Files touched: `src/routes/donate.tsx` (new), `src/components/SiteFooter.tsx`, `src/components/admin/Panels.tsx`, `src/routes/_authenticated/admin.tsx`, `src/lib/site-url.ts` or new `src/lib/donate.ts`, `PROJECT_STATE.md`.
- `routeTree.gen.ts` regenerates automatically for the new route.
- No database changes, no new dependencies, no email sequence changes.
