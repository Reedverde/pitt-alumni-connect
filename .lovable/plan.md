# Rename /weekend to /schedule

## Inventory: every /weekend path reference

### Route definition
- `src/routes/weekend.tsx:39` — `createFileRoute("/weekend")`; line 55 sets `og:url` to `${SITE_ORIGIN}/weekend`; line 34 names `weekendQuery` with key `["weekend-page"]` (key name is cosmetic, no URL impact).
- `src/routeTree.gen.ts` — generated, never edited; regenerates automatically from the renamed file.

### Internal Link / href
- `src/components/SiteNav.tsx:111, 163` — desktop and mobile nav links.
- `src/components/SiteFooter.tsx:37` — footer link.
- `src/components/schedule/ScheduleSummary.tsx:149` — `<Link to="/weekend" hash="where-to-stay">`; line 221 — another Link. Line 114 is a prose comment mentioning "/weekend".
- `src/routes/index.tsx:700` — homepage ghost-button Link.
- `src/routes/news.tsx:136` — news page Link.
- `src/lib/event-intent.ts:36` — default `returnTo: "/weekend"` for sign-in resume (consumed by `EventCardAnswer.tsx:98`, which passes `window.location.pathname` at runtime — no hardcoded path there).

### Server-side absolute URLs (emails, news, ICS)
- `src/lib/mail.server.ts:831` — `T_MINUS_14_WEEKEND_URL = "https://alumni.pittultimate.org/weekend?src=email"` (hardcoded, not via SITE_ORIGIN).
- `src/lib/admin.server.ts:2193, 2202, 2211, 2283, 2382` — `relatedUrl: ${SITE_ORIGIN}/weekend` in admin notifications; line 2301 is a prose comment.
- `src/lib/news.server.ts:204` — `related_url: ${SITE_ORIGIN}/weekend` for news items.
- `src/lib/ics.server.ts:128` — `URL:${SITE_URL}/weekend` inside generated .ics files.
- `src/lib/schedule.functions.ts:62` — prose comment only, no code change needed.

### Does NOT exist / no action
- No sitemap file (public/ has only favicon, og-card, robots.txt).
- `robots.txt` has no /weekend-specific rules.
- No canonical tag on the weekend page (only `og:url`).
- `public/og-card.jpg`, QR route, and drip/cron code do not reference /weekend.

## Plan

### 1. Rename the route file
- `git`-free `mv src/routes/weekend.tsx src/routes/schedule.tsx` and change `createFileRoute("/weekend")` to `createFileRoute("/schedule")`. TanStack Router regenerates `routeTree.gen.ts` automatically; the new URL is `/schedule`.
- Update `og:url` on the renamed route to `${SITE_ORIGIN}/schedule`.
- Rename `weekendQuery` key to `["schedule-page"]` (cosmetic, avoids confusion; safe because it is per-page local).

### 2. Permanent redirect /weekend → /schedule
- Keep a small `src/routes/weekend.tsx` that exports a route whose `beforeLoad` throws `redirect({ to: "/schedule", statusCode: 301 })`, forwarding `search` params (e.g. `?src=email` from previously sent emails) so attribution survives.
- Hash fragments (`#where-to-stay`) never reach the server, but old links in the wild only use `#where-to-stay` from our own ScheduleSummary, which we are updating anyway; note this limitation in PROJECT_STATE.md.
- Give the redirect route its own `head()` with `robots: noindex` so the stub URL is never indexed.

### 3. Update all internal links
- Point the six Link sites (SiteNav x2, SiteFooter, ScheduleSummary x2, index, news) and the `event-intent.ts` default `returnTo` at `/schedule`.
- Update the server-side URL builders (mail.server.ts T_MINUS_14_WEEKEND_URL → SITE_ORIGIN-based `/schedule`, admin.server.ts x5, news.server.ts, ics.server.ts) so all future sends embed the new URL. Old emails already sent keep working via the 301.
- Update prose comments that reference /weekend (schedule.functions.ts, ScheduleSummary.tsx, admin.server.ts, PROJECT_STATE.md entries going forward).

### 4. SEO / meta
- New route `head()`: title, description, og:title, og:description unchanged in wording, but og:url becomes `/schedule`.
- Add a canonical link tag on /schedule pointing to `${SITE_ORIGIN}/schedule` so the rename is unambiguous to crawlers.
- No sitemap exists, so nothing to update there; no robots.txt change needed (both paths allowed).

### 5. Verification
- `tsgo` typecheck clean (this catches every stale `to="/weekend"` via `FileRoutesByPath` once the stub route's path type is handled — the stub keeps `/weekend` valid, so links will be audited by grep instead).
- Build green, then Playwright: `/weekend` 301-lands on `/schedule`, `/schedule?src=email` keeps the param, nav/footer/homepage links all resolve, `#where-to-stay` anchor still scrolls.
- Update PROJECT_STATE.md with the rename and the redirect contract.

## Technical details
- Redirect uses TanStack Router `redirect()` in `beforeLoad`, preserving `search` via `search: (prev) => prev` semantics.
- No database changes. No copy changes (the word "weekend" in prose stays; only the URL moves).
