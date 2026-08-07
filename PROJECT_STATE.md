# PROJECT_STATE.md — Pitt Alumni Connect

## MODULE MANIFEST

| # | Module | Intensity | Status |
|---|--------|-----------|--------|
| 1 | Stability | Standard | In place: root errorComponent and notFoundComponent, error-capture.ts, error-page.ts, lovable-error-reporting.ts, SSR fallback in server.ts |
| 2 | Security | Standard | In place: RLS on every table, current_person_id() and is_admin() helpers, service role key server side only, 8 security fixes shipped 2026-07-30, anon email leak on identities closed and verified by impersonating anon and a real non-admin, admin privilege scoped to /admin only. Gap: no standing access-verification script, rsvps.party_size still readable by ordinary signed-in alumni |
| 3 | Accessibility | Standard | Partial: DESIGN.md sets aria-label on every chip, 2px Pitt Royal focus rings, real checkbox filters, prefers-reduced-motion. Not verified in code |
| 4 | Data & Backend | Standard | In place: 16 migrations, typed Supabase client, TanStack Query v5, derived board views, real person import complete. 368 people (367 real plus one test account), zero sample- rows remaining, 125 identities, 890 stints. Gap: no women's division rows exist yet, that import is deferred |
| 5 | Auth & Accounts | Standard | In place: magic link first with Google second, server side link generation via auth admin API, _authenticated route guard, three seeded admins |
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
| 17 | Environment & Secrets | Standard | Partial: Supabase vars set. RESEND_API_KEY, MAIL_FROM_ADDRESS, MAIL_UNSUBSCRIBE_SECRET, PUBLIC_SITE_URL, SUPABASE_SERVICE_ROLE_KEY status unconfirmed |
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

**Both GroupMe links received** after five asks. `groupme_b` Swagger Jacked, alumni only: https://groupme.com/join_group/25525883/XmguKcz4. `groupme_a` The Program, alumni and current: https://groupme.com/join_group/87254367/OrOti41l. Legacy bare `groupme` source value was retired and existing rows now read as null or were backfilled to the appropriate label where known.

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
- No standing access-verification script exists. Ad hoc checks were run tonight against the live database.
- Sequence key `t_minus_42` now carries offset `-45`. The key name was deliberately not renamed.
- The hero shows the CLAIM YOUR NAME button to signed-in visitors. For someone who has already claimed this is a dead button and wrong.
- The agent sandbox browser cannot render authenticated routes, so `/me` and the signed-in status bar are code-verified but not visually verified.


## ENV / SECRETS

Client side, configured:
- VITE_SUPABASE_URL, VITE_SUPABASE_PROJECT_ID, VITE_SUPABASE_PUBLISHABLE_KEY

Server side, configured:
- SUPABASE_URL, SUPABASE_PROJECT_ID, SUPABASE_PUBLISHABLE_KEY

Server side, status unconfirmed:
- SUPABASE_SERVICE_ROLE_KEY, required for magic link generation
- RESEND_API_KEY, required or mail falls back to the capped built in mailer
- MAIL_FROM_ADDRESS, required alongside RESEND_API_KEY
- MAIL_FROM_NAME, defaults to "Pitt Club Ultimate"
- MAIL_REPLY_TO, optional
- MAIL_UNSUBSCRIBE_SECRET, required for a valid unsubscribe token
- PUBLIC_SITE_URL, fallback origin for links in mail

## LAUNCH PLAN, CURRENT

- T-60, Monday Aug 3: committee members hand-send personal invites to their own anchors from their own inboxes and phones. No app email. The dormant T-60 sequence stays inactive permanently because a person does its job.
- T-45, Monday Aug 17: launch mass email. This is the old T-42 shifted three days. Everything after it keeps existing spacing: T-28 peer proof, T-21, T-14, T-7, T-2, T+3. NOTE: the sequence offsets have NOT been changed yet. One row goes dormant, one offset changes 42 to 45.
- Outreach coverage so far: Ben Morgenstern taking graduating years 2018 to 2024, Micah Davis taking the last four years. 2023 and 2024 are double covered. No shared coverage sheet exists.

## OPEN, NOT CODE

- Danger database disclosure to Christie Lawry or Bailey Moorhead. Overdue.
- DNS for alumni.pittultimate.org. Six records sent to Brody for the DreamHost zone: A alumni, TXT _lovable.alumni, TXT resend._domainkey.alumni, MX send.alumni, TXT send.alumni, TXT _dmarc.alumni. The DMARC record is deliberately scoped to _dmarc.alumni and must not be placed at the zone root. Brody supplied SFTP credentials, which are server access and not DNS. DreamHost will not create a co-manager account without a service, so he must add the records himself.
- Redirect from pitt.everde.co to the new domain, if and when it cuts over. Not built. The Discord post promises old links keep working.
- Nick Kaczmarek's coaching years, Mick van Ness's B coaching years. Never invent these.
- Micah Davis's 48-name 2026 roster, still zero emails.
- Sunday field and time.
- Maiden name needs its own field and its own display convention. Today the `played_as` column carries both nicknames and maiden names, which display differently: a nickname reads as Michael Van Ness "Mick", while a maiden name reads as Sarah Chen (née Whitfield) or Sarah Whitfield Chen. Rendering a maiden name in quotes like a nickname reads as careless to the people it matters most to. The board chip already carries too much visual noise to decide this inline; part of the work is deciding whether either value belongs on the chip at all, or whether both should be search-only and shown only on the profile. Scope when it is built: add a separate `maiden_name` column on `people`, distinct from `played_as`; make both fields editable by the person on `/me`; include both in the fuzzy match at signup; and agree on a display rule covering the board chip, the profile page, and search results. This matters most for the women's programs, whose alumni records track a significant number of name changes by hand. Status: not started. No target date.

## ROADMAP

NOW: write the standing access-verification script that runs as anon and as a non-admin and asserts per-role read and write on every table plus what can leave the mail system while paused. Narrow rsvps so party_size is admin only. Confirm or delete the remaining placeholder events. Add a pg_cron job pruning throttle_events older than 48 hours. Replace the og:image with a stable hosted asset. Publish a privacy policy and link it in the footer. Reconcile CONTEXT.md, BUILD_SPEC.md, DESIGN.md and URL_MANIFEST.md, all four now describe a site that does not exist.

NEXT: activate the eight drip sequences once the sending domain verifies. Import the 2026 roster of 48 names. Discord, GroupMe and Facebook syndication with src tracking. Analytics on claim and RSVP conversion. Virtualize the board. Women's division import, roughly 102 people, only after Christie Lawry and Bailey Moorhead have been contacted.

LATER: tournament tracker. Alumni job network built on the open_to_network consent flag. Edition rollover so the weekend repeats every year without a migration. Per year photo library.

## MASTER OS

- Retrofitted: 2026-07-30. Last synced 2026-08-01
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

## 2026-08-04
- Coaches and managers row moved to the bottom of the board, below the oldest year row. The 1978 anchor block is unchanged.
- Email typo guard added in `src/lib/email-typos.ts` with the `EmailSuggestion` control in `src/components/claim/ui.tsx`. Wired into the claim dialog email step, `/auth`, and the add an email field on `/me`. Structural validation blocks submit, a domain suspicion never does.

## One-click RSVP from email (mechanism only, drip still dormant)
`src/lib/rsvp-token.server.ts` signs a per-person, per-edition, 90-day answer token (own secret namespace, never a raw person id, never issued for a memorial record) and exposes `rsvpAnswerLinks(personId)` for the dormant drip. Links are `/rsvp?t=TOKEN&a=going|maybe|not_this_year`. The `/rsvp` loader (`src/routes/rsvp.tsx`) verifies and renders only, writing no RSVP state, so email security scanners cannot record answers. Every load logs `rsvp_link_opened` and every tap logs `rsvp_link_confirmed` to `audit_log`; both counts surface in the admin sends panel and the gap between them is the scanner signature. The tap writes the rsvp (`src = email`), verifies the identity and hands back an unspent one-time sign-in link, so the person lands on `/me` already signed in with no account step. Invalid or expired tokens redirect to `/?link=expired`, where the board shows a friendly line and offers the claim dialog. Nothing in this path sends email.
