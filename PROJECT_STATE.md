# PROJECT_STATE.md — Pitt Alumni Connect

## MODULE MANIFEST

| # | Module | Intensity | Status |
|---|--------|-----------|--------|
| 1 | Stability | Standard | In place: root errorComponent and notFoundComponent, error-capture.ts, error-page.ts, lovable-error-reporting.ts, SSR fallback in server.ts |
| 2 | Security | Standard | In place: RLS on every table, current_person_id() and is_admin() helpers, service role key server side only, 8 security fixes shipped 2026-07-30. Gap: no re-audit of public board views since |
| 3 | Accessibility | Standard | Partial: DESIGN.md sets aria-label on every chip, 2px Pitt Royal focus rings, real checkbox filters, prefers-reduced-motion. Not verified in code |
| 4 | Data & Backend | Standard | In place: 16 migrations, typed Supabase client, TanStack Query v5, derived board views. Gap: database still holds sample- prefixed rows, the real 468 person import has not run |
| 5 | Auth & Accounts | Standard | In place: magic link first with Google second, server side link generation via auth admin API, _authenticated route guard, three seeded admins |
| 6 | Design System | Standard | In place: full token set in styles.css, Archivo / Space Grotesk / Space Mono, one accent rule where gold means attending |
| 7 | Performance | Light | Gap: the board renders every chip with no virtualization. 468 people today |
| 8 | SEO | Standard | In place: full meta, Open Graph and Twitter card in __root.tsx. Gap: no sitemap, and og:image points at a Lovable R2 preview screenshot that will rot |
| 9 | Analytics | Light | Not started. The only signal today is rsvps.src captured from the query string |
| 10 | Email & Notifications | Standard | In place: Resend wrapper, sends log, suppressions, HMAC one click unsubscribe, Resend webhook, hourly admin digest. Gap: sending domain not delegated, all 8 sequences dormant |
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

- Board at `/`: built. Year rows, division filter, decade rail, five chip states
- Weekend schedule at `/weekend`: built. Equal width division lanes, no division nested under another
- RSVP as signup with fuzzy match: built
- Magic link and Google auth: built
- Profile at `/me`: built
- Admin at `/admin`: built. Review queue, people table, merge tool, roster import, photos, sends, editions
- Resend outbound with send log, suppressions and unsubscribe: built
- Calendar .ics export: built
- Peer verification within plus or minus 3 years: built, never exercised against real data
- Real 468 person seed import: not run. Sample rows still live
- Drip sequences: seeded dormant, awaiting a verified sending domain
- RSVP rate limiting: built. Three dimensions, soft and hard tiers
- Unmatched names as review requests with an hourly admin digest: built
- Privacy policy, analytics, automated tests: not started

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

## KNOWN ISSUES

- High: the database still holds roughly 50 sample- prefixed rows. The real 468 person import has not run
- Medium: og:image in __root.tsx points at a Lovable R2 preview screenshot URL that is tied to a preview build and will rot
- Medium: no privacy policy on a site holding 468 real names and 120 email addresses
- Medium: `throttle_events` has no pruning job. It grows forever and the count queries slow as it fills. Needs a pg_cron delete of rows older than 48 hours
- Low: the board renders every chip with no virtualization
- Low: 005_verify.sql has 29 checks and has never been confirmed PASS in a browser
- Accepted risk: an alum whose seeded name is misspelled now hits the review queue instead of getting a magic link. Three admins are the bottleneck, and it gets worse the week of the event
- Accepted risk: two team_names spans are marked assumed. The men's B changeover year and the women's A early span. Each is a one row update when the answer arrives

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

## ROADMAP

NOW: delete the sample rows and run the real 468 person import. Run 005_verify.sql and confirm all 29 checks PASS. Add a pg_cron job pruning `throttle_events` older than 48 hours. Replace the og:image with a stable hosted asset. Publish a privacy policy and link it in the footer.

NEXT: activate the eight drip sequences once the sending domain verifies. Import the 2026 roster of 48 names. Import the two women's division rosters. Discord, GroupMe and Facebook syndication with src tracking. Analytics on claim and RSVP conversion. Virtualize the board.

LATER: tournament tracker. Alumni job network built on the open_to_network consent flag. Edition rollover so the weekend repeats every year without a migration. Per year photo library.

## MASTER OS

- Retrofitted: 2026-07-30. Last synced 2026-07-30 after the rate limiting and review request work
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
