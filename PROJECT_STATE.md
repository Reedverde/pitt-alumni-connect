# PROJECT_STATE.md — Pitt Alumni Connect

## MODULE MANIFEST

| # | Module | Intensity | Status |
|---|--------|-----------|--------|
| 1 | Stability | Standard | In place: root errorComponent and notFoundComponent, error-capture.ts, error-page.ts, lovable-error-reporting.ts, SSR fallback in server.ts |
| 2 | Security | Standard | In place: RLS on every table, current_person_id() and is_admin() helpers, service role key server side only, 8 security fixes shipped 2026-07-30, anon email leak on identities closed and verified by impersonating anon and a real non-admin, admin privilege scoped to /admin only. rsvps.party_size is NOT a gap: the rsvps select policy is person_id = current_person_id() OR is_admin(), so row level RLS already limits every column to the owner and admins, verified 2026-09-03, no policy or code change needed. Gap: no standing access-verification script |
| 3 | Accessibility | Standard | Partial: DESIGN.md sets aria-label on every chip, 2px Pitt Royal focus rings, real checkbox filters, prefers-reduced-motion. Not verified in code |
| 4 | Data & Backend | Standard | In place: 16 migrations, typed Supabase client, TanStack Query v5, derived board views, real person import complete. 368 people (367 real plus one test account), zero sample- rows remaining, 125 identities, 890 stints. Gap: no women's division rows exist yet, that import is deferred |
| 5 | Auth & Accounts | Standard | In place: magic link first with Google second, server side link generation via auth admin API, _authenticated route guard, six admins (original three seeded: Reed Verdesoto, Brody Brotman, Nick Kaczmarek) |
| 6 | Design System | Standard | In place: full token set in styles.css, Archivo / Space Grotesk / Space Mono, one accent rule where gold means attending |
| 7 | Performance | Light | Gap: the board renders every chip with no virtualization. 468 people today |
| 8 | SEO | Standard | In place: full meta, Open Graph and Twitter card in __root.tsx. Gap: no sitemap, and og:image points at a Lovable R2 preview screenshot that will rot |
| 9 | Analytics | Light | Not started. The only signal today is rsvps.src captured from the query string |
| 10 | Email & Notifications | Standard | In place: Resend wrapper, sends log, suppressions, HMAC one click unsubscribe, Resend webhook, hourly admin digest, verified sending domain alumni.pittultimate.org live. Gap: no dispatcher, all ten sequences remain dormant even though copy is written for seven |
| 11 | Compliance & Legal | Standard | Gap: no privacy policy or terms on a site holding 468 real names and 120 email addresses |
| 12 | Discovery & Planning | Standard | In place: CONTEXT.md, BUILD_SPEC.md, DESIGN.md, URL_MANIFEST.md. Gap: they live outside this repo |
| 13 | Testing | Light | Not started. No Vitest, no Playwright. 005_verify.sql has 29 checks never confirmed PASS in a browser |
| 14 | Documentation | Standard | In place: this file, AGENTS.md, src/routes/README.md, project knowledge set 2026-07-30 |
| 15 | Graceful Degradation | Standard | In place: mail.server.ts never throws, falls back to the built in mailer, and the RSVP record saves regardless of send outcome |
| 16 | Loading/Empty/Error States | Standard | Partial: dashed prompt cards and invitation style empty states specified in DESIGN.md. Not verified across every route |
| 17 | Environment & Secrets | Standard | Partial: Supabase vars set. RESEND_API_KEY, MAIL_FROM_ADDRESS, MAIL_REPLY_TO, and PUBLIC_SITE_URL now configured and live. MAIL_UNSUBSCRIBE_SECRET and SUPABASE_SERVICE_ROLE_KEY status unconfirmed |
| 18 | Responsive & Mobile | Standard | In place: use-mobile hook, mobile type clamps, counter bar collapses to one line. Most alumni are on a phone |
| 19 | Backup & Recovery | Light | Gap: no export of the people table outside Supabase. Lovable Cloud defaults only |
| 20 | Rate Limiting | Standard | In place: three dimension throttle on `throttle_events`, service role only. Soft trip saves the RSVP and holds the mail, hard trip writes nothing, both return an identical response. Gap: no pruning job, the table grows forever |
| 21 | Observability | Standard | In place: every outbound message rows into sends whether it delivered or not, with provider, status and error |
| 22 | Cost of Ownership | Light | Lovable Cloud plus Resend free tier. Near zero at this scale. Exposure is tied to module 20 |
| 23 | Resource Guardrails | Standard | In place: global cap of 200 soft and 600 hard sends per hour. The admin digest counts against the same bucket so it cannot pump volume. Gap: no Resend account level spend cap |
| 24 | Change Impact Protocol | Light | Not started |

## PURPOSE

An alumni portal for four Pitt Club Ultimate programs. Its first job is collecting RSVPs for Alumni Weekend, Oct 2 to 4, 2026. Its long job is being a contact record that does not rot, because each person maintains their own row.

## ARCHITECTURE

- Frontend: TanStack Start 1.168, React 19.2, TypeScript 5.8, Vite 8, Tailwind v4, shadcn/ui with Radix, lucide-react, sonner, recharts
- Backend: Supabase via Lovable Cloud, project ref rupnjohygixerefzevsm. SSR on Cloudflare Workers via Nitro
- Auth: Supabase magic link first, Google second and never required. The link IS the account
- State: TanStack Query v5 plus TanStack Start server functions. No global store
- Server functions: account, admin, board, editions, photos, rsvp, schedule, signin, mail, ics
- Throttle: `src/lib/throttle.server.ts`. Three dimension counter over `throttle_events`
- Admin notice: `src/lib/admin-notify.server.ts`. Self throttling hourly digest, one per admin
- API routes: /api/photos/upload, /api/public/calendar.ics, /api/public/photo/$, /api/public/resend-webhook, /api/public/unsubscribe

## BUILD STATUS

- Board at `/`: built. Year rows, division filter, decade rail, five chip states, board key, and status filter
- Weekend schedule at `/weekend`: built. Equal width division lanes, no division nested under another. Directions links added for Schenley Overlook Shelter (10430 Overlook Dr), Ambrose Urbanic Field, and the Hilton Garden Inn
- RSVP as signup with fuzzy match: built
- Magic link and Google auth: built
- Profile at `/me`: built
- Admin at `/admin`: built. Review queue, people table, merge tool, roster import, photos, sends, editions
- Resend outbound with send log, suppressions and unsubscribe: built
- Calendar .ics export: built
- Peer verification within plus or minus 3 years: built, never exercised against real data
- Real person import: complete. 368 rows, 362 on the board, 6 hidden (test account plus the five records with no grad year). Women's divisions hold zero rows, import deferred
- Sending domain: verified and live. `alumni.pittultimate.org` is verified in Resend (DKIM, SPF, MX on `send.alumni`). Magic links confirmed in inbox with DKIM pass. From address: Pitt Club Ultimate <weekend@alumni.pittultimate.org>
- Drip sequences: copy written for seven sequences (t_minus_45, t_minus_28, t_minus_14, t_minus_10_headcount, t_minus_2, t_plus_3, discord_invite). All ten sequences remain `active = false`; there is no dispatcher, so flipping `active` does nothing
- RSVP rate limiting: built. Three dimensions, soft and hard tiers
- RSVP source tracking: `src` values widened to text, email, discord, groupme_a, groupme_b, facebook, instagram, x, esn, qr. Bare `groupme` retired
- Unmatched names as review requests with an hourly admin digest: built
- `/qr` route: built. Printable, full-screen QR poster for the board with `src=qr`, black on white, generated in bundle, print stylesheet
- Duplicate detection: surname hard gate at 0.85 evaluated before first-name scoring; exact match required for surnames under five characters
- Merge tool: reversible. Losing record is archived (`archived = true`, `merged_into_person_id`), not deleted, with full before and after state in `audit_log`; an Undo merge action restores it
- Privacy policy, analytics, automated tests: not started
- Sticky chrome geometry is CSS-defined: nav 72px on every route; board counter 57px and decade rail 49px. Anchor offsets use the resulting route-specific `--chrome-height` with no runtime measurement.


## RESOLVED TONIGHT (2026-07-31)

**Critical bug, silent RSVP loss.** `submitRsvpServer` held an anonymous-overwrite guard: when a person record already had a verified identity, the server skipped the RSVP write, the identity write and the email, then returned `ok: true, outcome: "recorded"` anyway. The user saw a claim stamp and nothing persisted. Present since the pass that added the guard, not caused by this session. Evidence: three `refused_verified_overwrite: true` rows in `audit_log`. Fixed: ownership is decided by the address submitted rather than the record; a non-matching address returns `sign_in_required` with `ok: false` and writes an `rsvp_refused_unverified_email` audit row; the RSVP row is read back after every write and the stamp is gated on `ok && written === true && rsvp`; insert and update errors are checked instead of discarded; `logRsvpEvent` writes console plus audit on every failure branch.

**Source tracking never worked.** `?src=` was never read anywhere. `ClaimDialog` passed a literal `"email"` and the server had a hardcoded `"email"` fallback, so all historic src values were meaningless and have been set to NULL. Now captured on first touch of any route in `__root.tsx`, held in sessionStorage, validated, written at insert only so first touch wins. Unknown or absent writes NULL, never a default.

**Allowed src values** (constraint `rsvps_src_check`): text, email, discord, groupme_a, groupme_b, facebook, instagram, x, esn, qr. Tagged links are `https://alumni.pittultimate.org/?src=<value>`.

**Board read parity.** `rsvps` had an anon SELECT policy but no authenticated equivalent, so signing in emptied the board (0 going vs 8). Added `public board rsvps authenticated`. Column grants on `rsvps` narrowed to id, person_id, event_year, status for both roles; party_size, src and responded_at now only via the `admin_rsvp_detail` security definer function, execute granted to authenticated only.

**RSVP confirmations enabled, forward only.** `app_settings.rsvp_confirmation_cutoff = 2026-08-01T02:59:07.702Z`, written once, never moves. Answers recorded before the cutoff are never confirmed. No catch-up or replay path exists and none may be built. Verified end to end: confirmation sent via Resend and received.

**Interest-form RSVPs cleared.** 14 rows imported in bulk from the interest form were deleted. They were real answers but not given through the site, so those people will be asked again. The source CSV still holds them and they are the warmest anchor list available. Live RSVPs are now Reed Verdesoto (going), Ben Morgenstern (going), Test Account (going, hidden from board).

**Schedule locked.** Friday Oct 2: Open Team Event/Dinner 7:00 to 10:30 PM (Pitt at Virginia Tech kicks off 7 PM on ESPN), Bar Crawl 9 PM onward. Both carry "Two options tonight, same night: come to either, both, or neither." Saturday Oct 3: BBQ 12:00 to 4:00 PM at Schenley Overlook, women's soccer vs Miami 7:00 PM. Sunday alumni games time and field still TBD.

**Hotel named.** Hilton Garden Inn Pittsburgh University Place, 3454 Forbes Ave, Oakland. No block, no group rate. Appears both as the `HotelBlock` on /weekend and in `editions.lodging_note`, which was updated tonight. Schenley Overlook Shelter street address: 10430 Overlook Dr. Directions links added for the shelter, Ambrose Urbanic Field, and the hotel.

**Both GroupMe links received** after five asks. `groupme_b` Swagger Jacked, alumni only: https://groupme.com/join_group/25525883/XmguKcz4. `groupme_a` The Program, alumni and current: https://groupme.com/join_group/87254367/OrOti41l. Legacy bare `groupme` source value was retired and existing rows now read as null or were backfilled to the appropriate label where known. Addendum 2026-09-03: superseded, see 2026-08-07 section, now a single shared link per current instruction.

**1978 question RESOLVED.** Brody's season page shows the 1977-1978 Pitt Fastbacks, organised by Randy Strausser via fliers on telephone poles. `team_names` now carries `Fastbacks` for 1978-1978 with confidence verified, and `Pitt Club Ultimate` for 1979-1997 as an explicit unknown placeholder to provoke corrections. Randy Strausser's 1978 `MENS_A` stint role is now `captain`.

**Duplicate-name rulings** from the previous session stand. Nothing merged.

## 2026-08-01

BUILD CHANGES SHIPPED TODAY (all deployed):

1. **WebKit and in-app-webview failure fixed.** The Supabase client read `window.localStorage` unguarded at init, which throws `SecurityError` in iOS webviews, Private Browsing and Lockdown Mode, so React never hydrated and every button was dead with no console error. Storage access is now guarded through `src/lib/safe-storage.ts`. Two related fixes: build target moved to Safari 15 in `vite.config.ts` so Tailwind stops emitting raw `oklch()` colors older iOS cannot render, and `Object.hasOwn` is polyfilled for the router in the same inline script.

2. **Navigation trap fixed.** `/me` previously rendered a bare main with no header or footer, so Sign out was the only way off the page. `/me` now carries the full site chrome. The header slot that read SIGN IN now shows the person's first name linking to `/me`, and Sign out moved to the bottom of `/me`.

3. **Board status filter added.** A "Filter by" row of three toggles: GOING, MAYBE, CLAIMED. There is deliberately no filter for "not this year"; declining is never publicly listable. Toggling now HIDES non-matching people rather than dimming them. The Programs filter still dims.

4. **Flat list mode.** Whenever the board is filtered, it stops grouping by year entirely and renders a single wall of matching name chips with a summary line such as "5 GOING". No year rows, no seals, no decade rail, no per-year empty prompts. The unfiltered board is unchanged.

5. **Going counter is now tappable.** Tapping the going figure isolates the board to people who are coming and shows a "Showing N going. Show everyone." reset line. Works signed out; no account is needed to filter or to see who is coming.

6. **Signed-in status bar.** A concrete-filled bar between the hero and the counter bar, signed in only, reading YOUR STATUS, CLAIMED with a check, and the three answer buttons with the current answer filled royal. A single gold dot appears next to GOING only when that is the person's answer.

7. **`/me` now states the answer in words** as "YOUR ANSWER: GOING" rather than relying on button fill colour alone, carries `aria-pressed` on all three buttons, and no longer renders a duplicate set of status buttons.

8. **Hero cleanup.** The signed-in "Your record / You're coming" row was removed as duplicated by the status bar. Note as a known issue: the hero now shows the CLAIM YOUR NAME button to signed-in people as well, which is wrong for someone who has already claimed. Unresolved.

9. **Nav logo.** The Pitt shield now appears in the header. Record this as a deliberate decision by Reed that overrides the previous DESIGN.md rule restricting the shield to the footer, and note the known consequence that gold now appears outside the attending state.

10. **OG social card added** at `public/og-card.jpg` with absolute-URL meta tags, origin held in one constant at `src/lib/site-url.ts`.

DATABASE CHANGE:

The `sequences` row formerly keyed `t_minus_42` has been renamed to `t_minus_45` and its `offset_days` remains `-45`, resolving to Aug 18 2026. The mismatch is fixed.

KNOWN ISSUES TO RECORD:

- Sequence key `t_minus_42` now carries offset `-45`.
- Hero shows CLAIM YOUR NAME to signed-in visitors.
- The agent sandbox browser cannot render authenticated routes, so `/me` and the signed-in status bar are code-verified but not visually verified.
- Four canonical docs still describe a `/why` route that does not exist; that content lives at `/alumni`.


## KEY DECISIONS

- Saying whether you are coming IS the signup. There is no separate account creation step and never a bare "Sign up" button, because a second step is where a 50 year old alum drops out
- Pitt Gold means attending and nothing else. No per team colors, because four accents destroys the only thing that makes the board readable at a glance
- The board is organized by graduating year filtered by division, not by era bands or four team pages, because one program's title history is not shared history
- Current year stints are blocked at the database level, not just hidden in the UI, because cuts land the week before the weekend
- No presumed stints were generated for the 173 people with no parsed history. Board placement falls back to grad_year instead, because fabricated rows are indistinguishable from real ones once a user touches them
- The person is the source of truth. Where seed data conflicts with what someone says about their own years, the person wins and nothing is queued for staff review
- Team names resolve at display time from division plus year. One row change updates every profile
- No alumnus ever sees another alumnus's email address. Only the three admins
- Memorial records are excluded from the fuzzy match pool and suppressed from every send the instant they are flagged, before confirmation
- Send to a friend queues names for admin review and sends nothing automatically, because an unmoderated send form is an open relay
- The site works with no DNS delegation. Only email sending depends on the domain
- Mass sends go through the existing Google Group, which already has deliverability history. The app sends transactional only
- A soft rate limit holds the mail but still saves the RSVP, because blocking the write would break invariant one for anyone behind shared campus or mobile wifi
- The admin alert is an hourly digest and never per request, because three admins times one junk submission is three outbound messages, which would turn the alert into the amplifier
- Board placement uses player and captain stints only. Coach, assistant coach and manager stints show on the profile and never move a person's chip, because an alum who comes back to coach would otherwise be moved out of the cohort that recognises their name and into the current year row
- The current year stint block applies to player and captain only. Coaches, assistant coaches and managers can hold a current year stint, admin entered, because the block exists to protect people who get cut and a sitting coach is not one of them

## KNOWN ISSUES, OPEN

- The four canonical docs (CONTEXT.md, BUILD_SPEC.md, DESIGN.md, URL_MANIFEST.md) describe a site that does not exist in at least six places. Not yet reconciled. Four of them still describe a `/why` route that does not exist; that content lives at `/alumni`.
- The hotel now lives in two places, the HotelBlock component and editions.lodging_note. Two sources of truth for one fact.
- No standing access-verification script exists. Ad hoc checks were run earlier against the live database.
- The hero shows the CLAIM YOUR NAME button to signed-in visitors. For someone who has already claimed this is a dead button and wrong.
- The agent sandbox browser cannot render authenticated routes, so `/me` and the signed-in status bar are code-verified but not visually verified.
- No dispatcher exists. Even though copy is written and `alumni.pittultimate.org` is verified, the sequences table is not read by any sender. Setting `active = true` currently does nothing.
- KEEP SEPARATE PERMANENTLY button in the admin Duplicates tab does not work. MERGE and NOT NOW do.
- Admin Duplicates and Review Queue badge counts do not match their lists. Likely the count query excludes differently than the list query.
- Second-stage first-name matching is undecided. Nickname equivalence must run before fuzzy percentage: Ben vs Benjamin scores 37 percent, Dan vs Daniel 50, Matt vs Matthew 57. Sibling false positives are the risk on the other side.
- Supabase Auth Site URL may still read `pitt-alumni-connect.lovable.app`. Not confirmed changed.
- The admin page says three people share it. There are six admins.
- Sabah B to BITT changeover year is still unknown.
- Off-site: danger database disclosure to Christie Lawry or Bailey Moorhead is overdue. Micah's 48-name 2026 roster and Sunday alumni game field still have no owner.


## ENV / SECRETS

Client side, configured:
- VITE_SUPABASE_URL, VITE_SUPABASE_PROJECT_ID, VITE_SUPABASE_PUBLISHABLE_KEY

Server side, configured:
- SUPABASE_URL, SUPABASE_PROJECT_ID, SUPABASE_PUBLISHABLE_KEY
- RESEND_API_KEY, domain-restricted to `alumni.pittultimate.org` (was briefly scoped to `pitt.everde.co` and returned 403 after the domain cutover)
- MAIL_FROM_ADDRESS, currently `weekend@alumni.pittultimate.org`, overriding the code constant
- MAIL_FROM_NAME, defaults to "Pitt Club Ultimate"
- MAIL_REPLY_TO, currently `weekend@alumni.pittultimate.org`
- PUBLIC_SITE_URL, currently `https://alumni.pittultimate.org`

Server side, status unconfirmed:
- SUPABASE_SERVICE_ROLE_KEY, required for magic link generation
- MAIL_UNSUBSCRIBE_SECRET, required for a valid unsubscribe token

Note: Lovable secrets cannot be overwritten by the agent; they must be deleted and recreated by hand if a value changes.

## LAUNCH PLAN, CURRENT

- T-60, Monday Aug 3: committee members hand-send personal invites to their own anchors from their own inboxes and phones. No app email. The T-60 sequence passed on Aug 3 with no copy and no sender; it will not be used.
- T-45, Monday Aug 17: launch mass email. Sending domain `alumni.pittultimate.org` is now verified and live. Sequence key renamed from `t_minus_42` to `t_minus_45` to match its `-45` offset (resolves Aug 18 2026). Copy is written for t_minus_45, t_minus_28, t_minus_14, t_minus_10_headcount, t_minus_2, and t_plus_3. There is still no dispatcher; sequences will not send until one is built and they are deliberately activated.
- Outreach coverage so far: Ben Morgenstern taking graduating years 2018 to 2024, Micah Davis taking the last four years. 2023 and 2024 are double covered. No shared coverage sheet exists.

## OPEN, NOT CODE

- Danger database disclosure to Christie Lawry or Bailey Moorhead. Overdue.
- Redirect from pitt.everde.co to the new domain, if and when it cuts over. Not built. The Discord post promises old links keep working.
- Nick Kaczmarek's coaching years, Mick van Ness's B coaching years. Never invent these.
- Micah Davis's 48-name 2026 roster, still zero emails.
- Sunday field and time.
- Maiden name needs its own field and its own display convention. Today the `played_as` column carries both nicknames and maiden names, which display differently: a nickname reads as Michael Van Ness "Mick", while a maiden name reads as Sarah Chen (née Whitfield) or Sarah Whitfield Chen. Rendering a maiden name in quotes like a nickname reads as careless to the people it matters most to. The board chip already carries too much visual noise to decide this inline; part of the work is deciding whether either value belongs on the chip at all, or whether both should be search-only and shown only on the profile. Scope when it is built: add a separate `maiden_name` column on `people`, distinct from `played_as`; make both fields editable by the person on `/me`; include both in the fuzzy match at signup; and agree on a display rule covering the board chip, the profile page, and search results. This matters most for the women's programs, whose alumni records track a significant number of name changes by hand. Status: not started. No target date.

## ROADMAP

NOW: write the standing access-verification script that runs as anon and as a non-admin and asserts per-role read and write on every table plus what can leave the mail system while paused. Narrow rsvps so party_size is admin only. Confirm or delete the remaining placeholder events. Add a pg_cron job pruning throttle_events older than 48 hours. Replace the og:image with a stable hosted asset. Publish a privacy policy and link it in the footer. Reconcile CONTEXT.md, BUILD_SPEC.md, DESIGN.md and URL_MANIFEST.md, all four now describe a site that does not exist.

NEXT: build a dispatcher that reads the sequences table and sends the active drips. Copy lives in TypeScript, so every wording change requires a deploy. Only activate when ready. Import the 2026 roster of 48 names. Discord, GroupMe and Facebook syndication with src tracking. Analytics on claim and RSVP conversion. Virtualize the board. Women's division import, roughly 102 people, only after Christie Lawry and Bailey Moorhead have been contacted.

LATER: tournament tracker. Alumni job network built on the open_to_network consent flag. Edition rollover so the weekend repeats every year without a migration. Per year photo library.

## MASTER OS

- Retrofitted: 2026-07-30. Last synced 2026-08-07
- Hub card: pitt-alumni-connect in project 45df6587-f345-46bd-bccc-3c2fa55467a7
- Hub article file: src/data/pitt-alumni-connect-articles.ts
- Lovable project ID: da83b43b-b24b-4b80-b9ec-619b1b431cbb

## Security pass, 2026-07-30
- /me now resolves the person strictly through identities.auth_user_id = auth.uid() via `resolveMyPersonId` in `src/lib/account-resolve.ts`. Every account server function ignores any client supplied personId.
- Root cause of the wrong record and the 123 addresses: the viewer was an admin, the admin SELECT policy on identities returns every row, and the page took row zero.
- identities policies rewritten: own person or admin for select, insert, update, delete. anon holds column grants on person_id and verified_at only.
- people column grants tightened for authenticated: no deceased_note, deceased_confirmed_*, is_anchor, seed_id, needs_review, member_no. Updates limited to the seven self editable columns.
- Data API access revoked for anon and authenticated on sends, suppressions, preapproved_emails, sequences, throttle_events, identities_needing_second_email.

## 2026-07-30 anon identities lockdown
- Dropped policy "identities public claimed flag only" and revoked all anon grants on public.identities. Anon read of identities now returns 401 / zero rows.
- board_people, board_year_counts and person_board_placement run with security_invoker = off so the public board keeps working without any anon access to identities. These views expose no email column. This is a deliberate trade against the linter's "security definer view" rule.
- /me resolves auth.uid() -> identities.auth_user_id -> person_id and filters every query by that id, including for admins. Verified: signed in as an admin, /me returns only Reed Verdesoto and his 3 own addresses while RLS would allow 124.
- throttle_events stays policy-free: written only by server code using the service role.

## Branding, login and email headers (2026-07-30)
Shared email chrome lives in `src/lib/email-chrome.ts`: table based header, live text wordmark PITT CLUB ULTIMATE in Pitt Royal, 1px chalk rule as a background row, Arial stack, pure white background, colour scheme pinned to light. Gold appears only on the going confirmation dot. The seal image is optional and read from the `MAIL_SEAL_URL` secret: no approved flat single colour ESN mark exists in the project yet, so the header currently ships wordmark only. `src/components/Lockup.tsx` renders the same lockup on /auth. The shield PNG stays in the footer only.

## Outbound email kill switch (2026-07-30)
`app_settings.outbound_email_mode` = `transactional_only` (default, admin editable, audited as `outbound_email_mode`).
Single choke point: `resendDeliver()` in `src/lib/mail.server.ts` — the only caller of the Resend send endpoint.
Allow list is by message kind: `magic_link` only. Everything else (digest, all drips, `t_minus_10_headcount`, admin test, party-size link) is refused there and writes a `sends` row with status `blocked`. The Supabase built-in mailer fallback consults the same `outboundEmailMode()`.
Admin: Mail configuration panel shows "Outbound email: paused. Only sign-in links are being sent." with a toggle.

## Pause leak fix and send outcomes (2026-07-30, later)
Leak: `src/lib/rsvp.server.ts:201` called `sendMagicLinkEmail` with no `kind`, and `src/lib/mail.server.ts` defaulted `kind` to `magic_link`, so RSVP confirmations were classified as sign-in links and passed the choke point. `kind` is now required with no default; the RSVP path sends `rsvp_confirmation`, which is refused while paused.
Repeats: every accepted `submitRsvpServer` call sent unconditionally, including the verified-owner branch that writes nothing. New `confirmation_sends` table (unique person_id + event_year + status) claims a row before the send and releases it only when the send never left, so one confirmation per person per edition per status change.
`sends.outcome` ('sent' | 'blocked' | 'failed' | 'suppressed') plus `blocked_reason`; every delivery count filters `outcome = 'sent'`.
Session: sessions are not time boxed (`auth.sessions.not_after` is null), refresh tokens rotate on use and the generated client persists and auto refreshes, so a sliding session outlasts 90 days. Access token JWT stays at the 3600s default; that value is a project auth setting with no tool exposed to change it. Sign out on /me uses `scope: "global"`.

## Schedule, 2026-07-30
9 events. Friday: Pitt football watch party 7 PM East Liberty, exact bar TBD, followed by an Oakland bar crawl at 9 PM. Both times are provisional and awaiting planner confirmation. The two overlap the ESPN broadcast window and the two venues are in different neighbourhoods; this reintroduces the split night that a single bar was chosen to solve.
Saturday BBQ at Schenley Overlook Shelter is booked and paid but still carries time_tbd, so it renders as TBD to every visitor. Needs a time.
Four division events remain placeholders: Sabah alumni gathering, Sabah alumni game, Pressure and BITT alumni gathering, Pressure and BITT alumni game. Confirm or delete.

## Known holes by year, accepted not blocking

These are visible on purpose. A visible hole recruits a correction, a hidden one does not. Do not hold launch for any of them. Nine belong to Brody and go out as one message.

| Year | Hole | Owner |
| --- | --- | --- |
| 1978 | 7 records, 20 years before the founding, unexplained. Team name span is null | Brody |
| 1979-1997 | Zero people. Unknown whether there is history here at all | Brody |
| 1998-1999 | Founding year and the year after are empty rows on the board | Brody |
| 1998-2005 | Pansy span, confidence assumed | Reed, then Nick |
| 2001, 2003, 2004, 2005 | 4, 3, 2 and 1 person. All under the 6 person thin-year threshold. Confirm the merge rule fires in the browser | Reed |
| 2005 | Men's B start year, Sabah B span, assumed | Jared |
| 2006 | Danger start year, assumed | Nick |
| 2006-2013 | Danger has no records across eight years | Nick |
| 2009/2010 | Sabah B to BITT changeover, assumed. One row update | Jared, then Brody |
| 2014 | 5 people, under threshold | Reed |
| 2019-2024 | 8, 6, 7, 20, 4, 5. The alumni page thins here. Missing records, not real squad sizes | Brody |
| 2026 | 48 names, 1 email, no stints, publicly visible before cuts land | Micah |
| No year | 5 records with null grad_year, hidden from the board | Brody |

## Annual edition runbook

The weekend repeats the first weekend of October. Anchored on the Friday. Every row needs an owner or it gets read in September.

| When | Task | Owner |
| --- | --- | --- |
| T-180 | Pitt football schedule that weekend, home or away and the TV window. Nothing Friday can be planned before it | Nick |
| T-150 | Open the next editions row, is_current false, published false | Reed |
| T-120 | Book the shelter. Minimum 11 days out, season ends the second Sunday of October, first come, no lottery | Unassigned |
| T-120 | Confirm the weather backup | Unassigned |
| T-100 | Name a hotel and hold a block, write lodging_note | Unassigned |
| T-90 | Confirm the Saturday campus anchor | Nick |
| T-90 | Sunday field permit | Unassigned |
| T-75 | Current roster and emails from the sitting captain | Captain |
| T-70 | Confirm the cut date and decide whether the current cohort shows on the board | Reed |
| T-60 | Anchor pre-send | Nick |
| T-60 | Refresh channel links: GroupMe, Discord, Google Group | Unassigned |
| T-45 | Publish the edition, flip is_current | Reed |
| T-45 to T-2 | Drip sequences run on the seeded offsets | Automatic |
| T-30 | Verify memorial flags before any mass send | Admins |
| T-7 | Lock every time, clear time_tbd on all events | Nick |
| T+3 | Wrap-up send with photos and headcount, and next year's date named inside it | Reed |

## Catch-up email for late approvals

Archived sends are never replayed. T-60 is a personal pre-send from Nick written for anchors before anything is public, and it reads as a form letter out of sequence. Replaying any send also breaks the rule that every send carries new information.

Instead there is one catch-up template, composed from current state at the moment it sends: where the weekend stands read live from events, lodging_note and travel_note as they read that day, how many people from the person's own years have said yes, and their claim link. After it lands the person enters the sequence at their real T-minus and gets the next scheduled send like everyone else.

Guardrails: it counts against the one email per person per 10 days global cap, and it is suppressed entirely if the person's status is already not_this_year. Dormant like everything else while outbound_email_mode is transactional_only.

## Duplicate name rulings, 2026-07-30
Five near-duplicate pairs were reviewed against the esnultimate.org alumni page and confirmed by Reed as separate people. Nothing was merged. Ryan Moore appears twice on that page as an exact string, so the two Ryan Moore records stay split. The other four pairs appear on the page under both spellings in separate tenure buckets with separate year ranges. No pair shares an email address.
Rulings are stored in `duplicate_rulings` so they survive future imports. Keep separate is permanent, Clear stores nothing and the pair returns on the next scan.
Two docs are now wrong and go on the reconcile list: BUILD_SPEC.md section 11 and CONTEXT.md section 5 both say the count is 468 and not 469 because dan-goldstein was folded into daniel-goldstein over a shared email address. That fold is not in this database and only Daniel carries an address. CONTEXT.md section 7 lists four duplicate-name pairs as open and owned by Brody. That item is closed.

## Magic link content leak, 2026-07-30
The sign-in email carried RSVP copy, the "we have you down as coming" line and the weekend dates. Because `magic_link` is the one kind the pause lets through, every status change minted a fresh link and delivered it. Three changes in one minute produced three emails, all sent, while the four matching `rsvp_confirmation` sends were correctly blocked. The kill switch never failed, the content walked around it.
Fix, three parts. The magic link template now says one thing, here is your link. All status and date copy moved into the `rsvp_confirmation` template where the pause already refuses it. A person with a verified identity and a live session no longer triggers a link on an RSVP change at all, since they can already sign in. And a 60 second per address guard returns the existing unexpired link instead of minting a new one, recorded in `magic_link_issues` with outcome `throttled`.

## duplicate_rulings grants, 2026-07-30
Revoked all `anon` and `authenticated` table grants on `duplicate_rulings`, leaving `service_role` only, matching sends, suppressions, preapproved_emails, sequences and throttle_events. The four admin RLS policies are untouched. The admin UI reads through server functions, so nothing changed on screen. Verified against pg_class privileges.

## stints.role, 2026-07-30
`assistant_coach` added to the role check constraint, which now reads player, captain, coach, assistant_coach, manager. An admin can add a stint from the person editor with any of those roles. Coach, assistant coach and manager may carry a null year, a playing season may not, and the current-season block still refuses players. No years were invented and David Lionetti's yearless coach record was not touched. Coach and assistant coach stints show the role on the profile.

## /admin is tabbed, 2026-07-30
One tab per panel: Review queue, People, Duplicates, Roster import, Editions, Schedule, Photos, Mail, Sends, Auth attempts. Tab state lives in the `?tab=` search param so a refresh keeps the tab. Review queue and Duplicates carry a count badge when either has pending items. Schedule holds the weekend-planning panels: headcount, data confidence, digest, drip and export. No panel changed behavior.

## The "I am not listed" paths, 2026-08-03
Three fixes, no schema change.

Magic link honours preapproved_emails. `requestSignInLink` used to look up `identities` only, so roughly twenty alumni Google Group addresses got complete silence. It now falls through to `preapproved_emails` and still sends the link. Verified with a temporary preapproved test address, which reached the mailer and was stopped only by a deliberate suppression row. An address in neither table is unchanged: neutral notice, nothing sent, `no_identity_match` logged.

/me no longer dead ends. A signed-in person with no person record gets a claim panel, "we just do not know which name on the board is yours", with two actions. Find my name searches the same fuzzy pool and attaches their verified address to that person as an identity, consuming any preapproval, refused if that name already has a verified account. I'm not on here, add me creates the record directly and files the suggestion already approved, since inbox possession is the proof an organizer would have been checking. Both live in `account.server.ts` behind `claimPersonAsMe` and `addMeAsPerson`.

A decline is a signup. An unmatched name still becomes a pending `new_person` suggestion, but the typed email now receives a sign-in link on every answer including not_this_year, and `party_size` is carried in the payload. Clicking the link marks the pending request `email_verified`, and approval then attaches that address as a verified identity, so the person is signed in on arrival. The answer was already written as a real rsvp row at approval time and still is.

Add-me is a control everywhere, worded "I'm not on here, add me". The board search empty state has a real button that opens the dialog with the typed text prefilled, the claim dialog shows the add-me button from the first keystroke rather than the third, the ActionRail circle opens the dialog in place instead of linking home, and /alumni FIND YOUR NAME and its closing button open the dialog. No gold anywhere in any of it.

## 2026-08-07

SENDING DOMAIN, now live

- `alumni.pittultimate.org` verified in Resend at 12:27 PM Aug 7. DKIM, SPF TXT on `send.alumni`, and MX on `send.alumni` all verified.
- DNS is in the `pittultimate.org` zone at DreamHost, entered by Brody. DreamHost cannot create MX on a subdomain through the DNS panel. The fix was creating `send.alumni.pittultimate.org` as its own domain entry, then using the Custom MX page scoped to that subdomain. Record this; it will be needed again.
- No DMARC record exists and none is planned. DreamHost's form strips the leading underscore so `_dmarc.alumni` cannot be created. DMARC is optional in Resend.
- The Resend API key was domain-restricted to `pitt.everde.co` and returned 403 on the new domain. Now scoped to `alumni.pittultimate.org`. Note: `checkSendingDomain()` verifies the domain is verified but not that the key is authorised for it, which let a doomed send through.
- From address is Pitt Club Ultimate <weekend@alumni.pittultimate.org>, set by the `MAIL_FROM_ADDRESS` secret which overrides the code constant. `MAIL_REPLY_TO` is `weekend@alumni.pittultimate.org`. `PUBLIC_SITE_URL` is `https://alumni.pittultimate.org`. Lovable secrets cannot be overwritten by the agent, only deleted and recreated by hand.
- Magic links confirmed delivering to inbox with DKIM pass.

DRIP COPY, written, all dormant

- Six sequences now have copy in `src/lib/mail.server.ts`: `t_minus_45`, `t_minus_28`, `t_minus_14`, `t_minus_10_headcount`, `t_minus_2`, `t_plus_3`. `discord_invite` already had copy.
- All ten sequences remain `active = false`. There is NO dispatcher. Nothing reads the `sequences` table and sends. Setting `active = true` currently does nothing.
- `t_minus_42` renamed to `t_minus_45` to match its actual offset. Resolves to Aug 18 2026.
- `t_minus_60` passed on Aug 3 with no copy and no sender.
- Copy lives in TypeScript, not the database, so every wording change requires a deploy. Only Reed can edit. Flagged as a structural problem for handover.

OTHER SHIPPED TODAY

- `rsvps.src` widened to: text, email, discord, groupme_a, groupme_b, facebook, instagram, x, esn, qr. Bare `groupme` retired. Unrecognised values store null. Existing rows: 28 text, 4 discord, 5 null.
- New unlisted route `/qr`, a printable QR poster encoding the board with `src=qr`. Black on white, generated in bundle, print stylesheet.
- Map Directions links added for Schenley Overlook Shelter, Ambrose Urbanic Field, and the Hilton. Schenley address `10430 Overlook Dr` now shown.
- Hotel named: Hilton Garden Inn Pittsburgh University Place, 3454 Forbes Ave. No room block, no group rate.
- **GroupMe consolidated to a single shared link.** The groupme_a/groupme_b split described here on 2026-08-07 is superseded by current instruction: GroupMe is treated as one platform with one shared link, not two. The rsvps.src constraint and any UI still referencing groupme_a/groupme_b need updating to a single `groupme` value. Not yet executed in code as of this note, tracked as a follow-up.
- `team_names`: Fastbacks 1978 to 1978 verified. Pitt Club Ultimate 1979 to 1997 confidence unknown, a deliberate placeholder to provoke corrections, not history. Randy Strausser's 1978 stint set to `captain`.
- 1978 question RESOLVED. Brody's season page shows the 1977-1978 Pitt Fastbacks, organised by Randy Strausser via fliers on telephone poles.
- Duplicate detection: last name is now a hard gate at 0.85 evaluated first, exact match required for surnames under 5 characters.
- Merge is now reversible. Losing record is archived, not deleted, with before and after state in `audit_log` and an Undo merge action.

STILL OPEN

- No dispatcher. Nothing automates.
- KEEP SEPARATE PERMANENTLY button does not work. MERGE and NOT NOW do.
- DUPLICATES badge and REVIEW QUEUE badge both show counts that do not match their lists. Likely the same root cause, a count query that does not exclude what the list excludes.
- First name matching, second stage, undecided. Reed asked for 60 percent fuzzy. Flagged that nickname equivalence must run first: Ben against Benjamin scores 37 percent, Dan against Daniel 50, Matt against Matthew 57. Sibling false positives are the risk on the other side.
- Supabase Auth Site URL may still read `pitt-alumni-connect.lovable.app`. Never confirmed changed.
- Admin page says three people share it. There are six admins.
- Sabah B to BITT changeover year still unknown.
- Off-site: Danger database disclosure to Christie Lawry or Bailey Moorhead, still overdue. Micah's 48 name roster. Sunday alumni game field, still nobody's name against it.

## 2026-08-04
- Coaches and managers row moved to the bottom of the board, below the oldest year row. The 1978 anchor block is unchanged.
- Email typo guard added in `src/lib/email-typos.ts` with the `EmailSuggestion` control in `src/components/claim/ui.tsx`. Wired into the claim dialog email step, `/auth`, and the add an email field on `/me`. Structural validation blocks submit, a domain suspicion never does.

## One-click RSVP from email (mechanism only, drip still dormant)
`src/lib/rsvp-token.server.ts` signs a per-person, per-edition, 90-day answer token (own secret namespace, never a raw person id, never issued for a memorial record) and exposes `rsvpAnswerLinks(personId)` for the dormant drip. Links are `/rsvp?t=TOKEN&a=going|maybe|not_this_year`. The `/rsvp` loader (`src/routes/rsvp.tsx`) verifies and renders only, writing no RSVP state, so email security scanners cannot record answers. Every load logs `rsvp_link_opened` and every tap logs `rsvp_link_confirmed` to `audit_log`; both counts surface in the admin sends panel and the gap between them is the scanner signature. The tap writes the rsvp (`src = email`), verifies the identity and hands back an unspent one-time sign-in link, so the person lands on `/me` already signed in with no account step. Invalid or expired tokens redirect to `/?link=expired`, where the board shows a friendly line and offers the claim dialog. Nothing in this path sends email.

## 2026-08-14 News, RSS and automated bulletins

Built the public news bulletin, the RSS feed for MonitorRSS, the admin News tab, the
scheduled automation, and the larger Discord feature.

### Migrations
- `news_items`: title, summary, body, category, post_type, status, published_at,
  related_url, author, dedupe_key. Anyone reads rows that are published with a
  published_at in the past. Admins read and write everything.
- `news_pending_updates`: kind, title, summary, category, related_url, status
  (pending, suppressed, consumed), dedupe_key. Admin only.
- `news_roundup_members`: event_year plus person_id, unique together. Stops the weekly
  roundup ever naming the same person twice for one edition. Admin read only.
- `news_settings`: singleton. enabled, timezone America/New_York, daily_digest_time
  19:00, weekly_day 1 (Monday), weekly_time 09:00, last_digest_date, last_weekly_date.
- Follow-up migration revoked anon privileges on the three internal news tables and
  revoked anon writes on news_items. Public keeps SELECT on news_items only.

### Code
- `src/lib/news-types.ts` client safe shapes, categories and post types.
- `src/lib/news.server.ts` listPublished, listPending, listAllNews, loadSettings,
  addPendingUpdate, previewDigest, publishDigest, publishWeeklyRoundup,
  runNewsAutomation, buildRss.
- `src/lib/news.functions.ts` public read. `src/lib/news-admin.functions.ts` admin
  gated writes, all through adminActor which calls is_admin().
- `src/routes/news.tsx` public archive. `src/routes/news.xml.ts` RSS 2.0.
- `src/routes/api/public/hooks/news-cron.ts` scheduled entry point, apikey gated.
- `src/components/admin/NewsPanel.tsx` and a News tab in /admin.
- `src/components/DiscordCta.tsx`, used on /weekend, / and /news.
- `src/components/news/LatestNews.tsx` on /weekend.
- News link added to SiteNav on desktop and in the mobile menu.

### Scheduling
pg_cron job `news-automation-15min` runs every fifteen minutes and POSTs to
`/api/public/hooks/news-cron` with the publishable key in an apikey header. The
endpoint runs nothing unless the New York local clock has passed the configured slot
and the slot has not already been used. Daily digest is capped at one per local
calendar day, the weekly roundup at one per configured week, so DST shifts and retries
are both safe. No browser needs to be open. Nothing else was scheduled.

### Digest rules
Only meaningful public changes create pending updates: schedule time, date or location
confirmed or materially changed, lodging_note or travel_note materially changed, and a
campaign email actually being sent. One pending item per campaign, never per recipient.
Magic links, sign in mail, RSVP confirmations, admin alerts and internal edits create
nothing. If nothing is pending at digest time, nothing publishes. Included items are
marked consumed so they never appear twice.

### Weekly roundup
Names people who newly moved to going since the last roundup and are still going at
generation time, using public display names only. Members are recorded in
news_roundup_members so retries are idempotent and nobody repeats. Publishes nothing
when nobody new qualifies.

### Dispatcher
Unchanged safeguards. Still admin button driven, still dry run by default, still
respects active flags, audience states, the two day due window, suppressions, memorial
and archived exclusions, the ten day recent send rule, per sequence already sent
tracking, and outbound_email_mode. It now writes one campaign level pending news item
after a successful send batch. discord_invite has copy and will send correctly when it
is deliberately activated. Nine of ten sequences remain dormant. t_minus_45 was already
active before this pass and is not due until 2026-08-18, so nothing goes out on its own.

### RSS URL for MonitorRSS
https://alumni.pittultimate.org/news.xml

### Remaining manual setup
None for scheduling. Sequence activation stays a deliberate admin decision.

## 2026-08-17 News automation audit and hardening

No news item was published, no roundup member was inserted, last_weekly_date and
last_digest_date remain null, no email went out, and no sequence was activated during
this pass. Verified after the changes: 0 news_items, 0 news_roundup_members for 2026,
0 pending updates, 0 sends in the last hour, cron job active.

### Weekly roundup window, corrected
The roundup used to qualify anyone currently going who had never appeared in
news_roundup_members, so the first run would have listed all 58 historical going
records. It now qualifies on rsvps.responded_at for the current edition:
after a previous run, responded_at later than last_weekly_date at local midnight;
on the very first run of an edition, a seven day lookback from generation time.
The person must still read as going on board_people at generation time, which also
keeps archived and memorial records out and keeps the public display name convention.
news_roundup_members stays the permanent per edition no repeat guard. Dry run, admin
preview, and live publication all take the identical qualifying path. Verified today:
preview returns 30 names, not 58. One of the 31 recent going responses is not on the
public board, which is why the number is 30 and not 31.

### Cron authentication, corrected
The endpoint used to accept the publishable key, which is public. It now requires a
random 64 character token in an x-cron-token header. Only a SHA-256 hash of that token
is stored, in public.internal_secrets, a table with RLS on and deliberately no policies
and no anon or authenticated grant, so no signed in user, admin included, can read it
and no public or admin API returns it. The raw token exists only inside the pg_cron job
definition. The endpoint hashes the presented token and compares in constant time.
news-automation-15min was recreated with the token, same 15 minute cadence, still
active. Verified: no header, old publishable key, and a wrong token all return 401;
the real token verifies true.

### addPendingUpdate error handling, corrected
Only a 23505 unique violation is treated as an idempotent duplicate. Any other database
error is logged with kind and dedupe key and returns ok false, so update loss is visible
instead of silent.

### Material event changes now queue news
There was no event edit path at all: create and delete only. Added
updateEditionEvent in admin.server.ts, the adminUpdateEditionEvent server function, and
an inline Edit form on each event row in the Editions panel. A pending update is queued
only when day_number, starts_at, location, or time_tbd materially changes. Title and
notes edits, no op saves, and changes that leave the event still TBD with the same day
and place queue nothing. Dedupe key is event_change:<id>:<day>|<starts_at or tbd>|<place>,
so retries collapse and a later distinct material change queues its own item.

### Genuine remaining gaps
- Pending updates support edit and suppress only. Delete and combine or collapse of
  several pending items into one were never implemented. Suppress is the way to drop
  one; the digest already collapses everything pending into a single item.
- No photo gallery publication trigger. The photo model has upload plus slot
  assignment and no published gallery state, so there is nothing meaningful to
  announce. Left unimplemented on purpose until a gallery state exists.
- News copy for automated items is generated in TypeScript, so wording changes still
  need a deploy.

## 2026-08-17 Direct Discord delivery for News

Discord no longer depends on MonitorRSS. `/news.xml` stays exactly as it is and
remains the public secondary feed.

### Secret, required manual step
The webhook that was pasted into a chat window is compromised. Delete that
webhook in Discord, regenerate a new one, and never reuse the old value
anywhere. Then add the new URL as a secure Lovable project secret named
`DISCORD_NEWS_WEBHOOK_URL` (Project Settings, Secrets). It is read only via
`process.env` inside a server handler. It is never sent to the browser, never
logged, never written to a row, never included in an audit payload, and never
shown in the admin UI. With the secret absent the site behaves normally and
every publish records a Discord delivery failure instead of blocking.

### Code
- `src/lib/discord-news.server.ts`: builds one compact embed (title, summary
  plus body, category in the footer, link back to the item) and posts it with
  `?wait=true` so the message id can be stored. Long bodies, such as the first
  weekly roundup with every current Going alumnus, split across embed fields so
  the whole item stays one logical message. Errors are scrubbed of anything
  webhook shaped before they are stored.
- `deliverPublishedItem()` in `src/lib/news.server.ts` is the single fire point,
  wired into the daily digest, the weekly roundup, manual publish, urgent
  publish, publish digest now, and publishing an existing draft.

### Idempotency
`news_items` now carries `discord_posted_at`, `discord_message_id`,
`discord_delivery_status` (`not_sent` / `sent` / `failed`) and
`discord_delivery_error`. Delivery returns early when `discord_posted_at` is set
or the status is already `sent`, so edits, retries, and unpublish then
republish can never post a second message. Drafts are never posted.

### Admin
The Published News list shows Discord: Not sent / Sent / Failed with the last
error, a Retry Discord button on any published item not yet sent, and a Send
test to Discord button that posts a short fixed message and creates no news
item. Both actions are admin gated and audited.

### Verified at build time
Typecheck clean, `/news` and `/news.xml` both 200 with the secret absent, no
news item published, no Discord request attempted, no email sequence touched.

## DRIP DAILY CRON (added 2026-08-19)

- Route: `POST /api/public/hooks/drip-cron-tick`. Guarded by the `x-drip-cron-secret` header, compared against the `DRIP_CRON_SECRET` project secret. Missing or wrong secret returns 401.
- Runner: `src/lib/drip-cron.server.ts`. Target date per sequence is `editions.starts_on` of the current edition plus `offset_days`. A sequence runs when the Eastern date is on or after its target date, so a missed day catches up instead of skipping.
- The outbound switch opens to `all` for exactly one sequence dispatch and is reset to `transactional_only` in a finally block, plus a second forced reset around the whole run.
- Every sequence attempt writes one `audit_log` row: action `drip_cron_tick`, `table_name` sequences, `record_id` the sequence id, after jsonb carrying sequenceKey, sent, failed, skips, refusalReason, error, targetDate, runDate.
- Schedule: pg_cron job `drip-daily-2000-et`, expression `0 0 * * *` UTC, which is 20:00 America/New_York during Eastern Daylight Time. The job body carries a date guard so the first run is 2026-08-20 Eastern.
- Inspect with `select * from cron.job` and `select * from cron.job_run_details order by start_time desc`. Disable with `select cron.unschedule('drip-daily-2000-et')`.

## 2026-09-03 Correction: hotel and GroupMe status re-confirmed

No code changed in this pass. Two facts were re-verified against this file after being misstated in conversation:

- The hotel (Hilton Garden Inn Pittsburgh University Place) has been named, shipped to HotelBlock and editions.lodging_note, and live since 2026-08-07. It should never again be treated as an open item.
- GroupMe is a single shared platform link per current instruction, not two separate links. The groupme_a/groupme_b values in this file predate that decision and are marked superseded above; the actual rsvps.src constraint and UI labels still need a follow-up migration to collapse to one `groupme` value, this has not been done yet.

Also noted: app_settings has no event_start_date key. The real mechanism for computing T-minus offsets is editions.starts_on on the current edition row, read by the drip cron (see DRIP DAILY CRON section above). A row was added to app_settings today with key event_start_date value 2026-10-02 and a sequences row event_rsvp_prompt at offset_days -25, outside of this repo's actual dispatch mechanism. These may be redundant or dead relative to editions.starts_on and should be reviewed against the real schema before being relied on, rather than assumed live.


## 2026-09-03 Event RSVPs, source consolidation, admin count

Three migrations ran, plus code.

**Migration 1, schema and cleanup.** Created `event_rsvps` (person_id, event_id, status yes or no, party_size default 1, responded_at, unique person_id + event_id, owner and admin RLS, grants, updated_at trigger). Deleted the two stale division split alumni game placeholder rows, superseded by the single combined Alumni Game event, nothing referenced them. Deleted the stray `app_settings.event_start_date` row so there is exactly one date mechanism.

**Migration 2, rsvp source consolidation.** One row tagged `groupme_a` was backfilled to `groupme`. No rows existed for `groupme_b`, `groupme_alumni`, `groupme_all` or `website`. `rsvps_src_check` now allows only text, email, discord, groupme, facebook, instagram, x, esn, qr, plus null. `src/lib/rsvp-src.ts` matches, and the split labels are gone from the UI. The GroupMe follow-up flagged on 2026-08-07 is now closed.

**Migration 3, sequence offset.** `sequences.event_rsvp_prompt.offset_days` set to -24, chosen to clear the 7 day global throttle after t_minus_28. The sequence remains `active = false`. Timing is computed the only supported way, `editions.starts_on + offset_days` on the current edition, so it repeats every year with no hardcoded date.

**Gating.** Per event questions are only ever asked of someone whose main rsvp status is `going` for the current edition. Maybe never triggers them. Inline: the claim dialog shows a per event step immediately after a going answer, skippable, and a failure there never affects the already saved weekend RSVP. Drip fallback: `event_rsvp_prompt` emails only the unanswered events. A yes or a no both retire that event for that person for good.

**2026-09-04 scope change.** Prompt events are no longer a BBQ and Alumni Game allowlist. `loadPromptEvents` returns every event row of the current edition, placeholders included (Bar Crawl collects a soft interest signal even unhosted), and that list is the single write allowlist for `submitEventRsvpsServer`. The card toggles on `/weekend` and the homepage summary, the claim dialog step, the drip unanswered check, and the admin per event headcount panel all read the same list, currently 7 events.

**Admin.** Event answers show inline in the People tab expanded row, joined per person from `event_rsvps`, no separate dashboard. The header copy now says six people share the page, not three.

Nothing was sent. `outbound_email_mode` stayed `transactional_only` and every sequence `active` flag is unchanged.

**2026-09-04 route rename.** The schedule page moved from `/weekend` to `/schedule` (`src/routes/schedule.tsx`). `src/routes/weekend.tsx` is now a permanent 301 stub that forwards the query string, so `?src=email` attribution in previously sent emails survives. Hash fragments never reach the server, so pre-move `#where-to-stay` links land at the top of `/schedule`; every internal hash link was updated. All nav, footer, homepage, news, `event-intent` returnTo, mail, admin, news, and ICS URL builders now emit `/schedule`, and the page carries a canonical tag. The stub route is `noindex`.

## 2026-09-04 Donate page, footer gives, hotel consolidation

**Donate.** New public route `/donate` (`src/routes/donate.tsx`) presents three equal ways to give: the Pittsburgh Foundation endowment fund, PayPal, and Venmo. The PayPal and Venmo cards each carry a plain note that the gift goes to Brody Brotman personally, not to a program or organization account, and is not tax deductible or club handled. All three URLs live in `src/lib/donate.ts`, the one place they are defined.

**Footer.** The old direct external "Endowment" link to esnultimate.org is gone. The footer now links Endowment, PayPal, and Venmo, all to `/donate` with hash anchors (#endowment, #paypal, #venmo), so there is one canonical page. The footer label "Weekend" was also aligned to "Schedule" to match the nav rename.

**Admin QR.** New `DonateQrPanel` in `src/components/admin/Panels.tsx`, rendered in the Schedule tab below the per event headcount panel. Three QRCodeSVG codes (level H, black on white, same print pattern as the /qr poster), one per donation URL. Static constants, no fetch, no server change.

**Schedule page hotel consolidation.** The hardcoded HotelBlock is deleted, including its Saturday-only render call. The editions driven WhereToStay section (reads editions.lodging_note and travel_note) moved from the bottom of the page to directly after the header, so it is the first content block. No content or data change.

**2026-09-04 event toggles on every event.** The per event RSVP prompts were expanded from the BBQ and Alumni Game allowlist to every event of the current edition, placeholders included, and the card level answer toggles on `/schedule` and the homepage summary now cover all 7 events. See the 2026-09-03 Event RSVPs section above for the write allowlist contract.

**2026-09-04 homepage story rewrite.** `/` now opens with story content between the hero and the counter bar: section 1 "The climb" (We came back), section 2 "Why this weekend" (You don't stop being Pitt Ultimate), and section 3, a new `WeekendColumns` component (`src/components/home/WeekendColumns.tsx`), a three column FRIDAY / SATURDAY / SUNDAY teaser of notched white cards that each link to `/schedule`. `/schedule` stays the single source of truth for times, locations, and per event RSVP, so the homepage's `ScheduleSummary` (full per event tiles with toggles) was removed along with its `weekendQuery` loader entry; the homepage loader now fetches only the board. Copy is approved verbatim. No gold in the new sections.


