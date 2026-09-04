# Site Audit Against the New Homepage

Audit only. No page is redesigned in this turn. Every finding below was confirmed by reading the project and by loading each route at desktop (1280) and mobile (390).

## 1. Route inventory

Public
- `/` primary homepage: masthead nav, hero, 2005 story, shared claim board
- `/v2` noindex alias of the same components
- `/alumni` the long-form "Always Pitt Ultimate" story page
- `/schedule` weekend schedule, lodging, per event calendar links
- `/weekend` permanent redirect to `/schedule`
- `/news` bulletins, with an RSS alternate
- `/donate` three ways to give
- `/editions/$year` archived weekend
- `/auth` and `/auth/callback` sign in
- `/rsvp` one tap answer from an emailed link, noindex
- `/qr` printable poster, noindex

Member
- `/me` the member record and answer page, behind the authenticated gate

Organizer
- `/admin` eleven tabs of organizer tools, admin gated, noindex

Machine endpoints (no visual surface, excluded from scoring): calendar and event ics, headcount, photo proxy, unsubscribe, resend webhook, cron hooks, news feed, photo upload, drip dry run.

## 2. Scorecard

| Route | Verdict |
| --- | --- |
| `/` and `/v2` | Strong, the reference |
| `/schedule` | Needs refinement |
| `/news` | Needs refinement |
| `/rsvp` | Needs refinement |
| `/auth`, `/auth/callback` | Needs refinement |
| `/qr` | Strong for its purpose, leave alone |
| `/alumni` | Needs redesign |
| `/donate` | Needs redesign |
| `/editions/$year` | Needs redesign |
| `/me` | Needs redesign |
| `/admin` | Deliberately quiet, refinement only |

## 3. Findings

Navigation and chrome
- Two navigations exist. The homepage uses the centred masthead; every other page uses the older left aligned wordmark bar. The two differ in height, type size, tracking and active treatment, so moving from the homepage to any other page reads as a different website.
- The masthead still lists a "Home" tab pointing at `/v2` and a separate "Board" tab pointing at `/`. Since the promotion, those are the same page and one of them is now redundant.
- The older bar has no link to Give at all, so `/donate` is reachable only from the footer and from the homepage.
- The footer appears on only three pages. Schedule, alumni, donate, editions, auth, and rsvp all end abruptly with no wayfinding.
- Page width is inconsistent: the homepage runs to a wide editorial measure, admin to a mid width, and several pages sit at a narrow reading column, while donate uses almost no side padding at all at desktop.

Shape language
- The project has two competing shape systems. The newer chamfer tiers with softened vertices power the homepage; the older notch system produces razor sharp diagonal points and is still used by the alumni photo tiles, the schedule hero and blue callout, the edition tiles, the Discord call to action, the weekend columns, and the admin photo panel.
- Corner values are ad hoc elsewhere: a scattering of one off small radii across dialogs, inputs, menus and admin fields rather than a shared step.
- Donate, auth and news are all plain rectangles where the visual language calls for at least one shaped anchor.
- The schedule page overuses the treatment: the hero, the blue notice plane and several row containers are all cut, which flattens hierarchy rather than creating it.

Photography
- Photographs outside the homepage are pushed through a blue duotone filter. The alumni tiles, the board year photos, the schedule hero and the sideline strip all render in false colour. The stated direction is original image colours.
- Several photo slots on `/alumni` render as empty grey planes with only a caption and an index number, so a third of that page is blank boxes at desktop.

Hierarchy and breathing room
- `/alumni` sets a very large display headline and then drops to a narrow left column with an empty right half for the rest of the page. No editorial rhythm, no pacing, no closing action.
- `/donate` is a bare three card row on an otherwise empty screen with no header, no story, no footer.
- `/me` is a single very long stacked form of hairline separated sections. It carries the most personal content on the site and has the least visual identity.
- `/editions/$year` reads as a data dump of the schedule rather than a record of a weekend.

States
- `/editions/2025` returns a server error rather than a friendly page, because the edition is not published. The error text reaches the browser console.
- Empty, loading and error states are one line of grey text almost everywhere: admin loads with a bare "Loading", empty tables show a single sentence, the edition error is a stub heading with no navigation back.

Accessibility
- Contrast: light grey secondary text on the near white page background is used heavily for body copy on donate, news, admin and me, not just for captions.
- Focus: navigation, chips and several custom buttons are styled as inline elements with borders and colours removed, so keyboard focus is hard to see on the masthead and inside dialogs.
- Touch targets: the masthead mobile menu and the older nav's controls are different sizes, and several inline text actions in admin and `/me` are below a comfortable target.
- Status by colour: attendance state leans on gold and royal alone in places; the answer should always carry a word as well.
- Reduced motion is not honoured anywhere; the sideline strip and hover transitions run regardless.
- The mobile menus in both navigations trap no focus and are announced as menus while containing plain links.

Language
- Status wording drifts across surfaces: the board, the claim dialog, `/me` and admin do not all use the same three phrases for going, maybe and not this year, and admin adds separate phrasing for no response and planned heads.
- The same object is called a weekend, an edition, and the schedule in different places.
- Give versus donate versus support the program are used interchangeably.

Consolidation candidates
- One navigation component with one active treatment, used everywhere.
- One footer, used everywhere.
- One page shell that owns width, vertical rhythm and the nav plus footer pairing.
- One shape module: retire the sharp notch system in favour of the softened chamfer tiers.
- One photo component with original colour as the default.
- One set of button, field, card, table, dialog and status chip primitives, replacing the parallel inline style objects in the claim and admin folders.
- One status vocabulary module that every surface reads its words from.

## 4. Phases

Each phase is independently shippable and independently verifiable.

Phase A. One chrome everywhere
Direction: the masthead becomes the only navigation on the site and the footer appears on every page with a visual surface. Resolve the duplicate Home and Board tabs into a single Home, and give Give a place in the bar. Keep the poster page and the emailed answer page chrome free.
Acceptance: every public and member page shows the same header and the same footer; no page has two ways to reach the homepage; poster and one tap answer pages are unchanged; all existing links still work.

Phase B. Shared page shell and spacing scale
Direction: introduce one shell that sets the page width, the top and bottom rhythm, and the section spacing used by the homepage, then adopt it on schedule, alumni, news, donate, editions and me. Nothing inside the sections changes yet.
Acceptance: those pages share one content measure and one vertical rhythm at desktop and mobile; donate no longer sits flush to the screen edge; the homepage is pixel unchanged.

Phase C. One shape system, true colour photography
Direction: retire the sharp cut system and move every shaped element to the softened chamfer tiers. Make original colour the default for photographs and remove the blue duotone. Reduce the schedule page to one shaped anchor rather than several.
Acceptance: no sharp diagonal point remains anywhere; every photograph renders in its own colours; the shaped element count on schedule drops; the homepage is unchanged.

Phase D. Component and language consolidation
Direction: replace the parallel inline style objects with one shared set of buttons, fields, cards, tables, dialogs and status chips, and route every attendance word through one vocabulary so public, claim, member and organizer surfaces say the same thing. Fix the empty photo slots on alumni by either supplying images or removing the slots.
Acceptance: one button and one field appearance across the site; the three attendance answers read identically on the board, in the claim flow, on the member page and in admin; no blank photo placeholders remain.

Phase E. States and accessibility
Direction: give every list, table and page a written empty state, a calm loading state and a recoverable error state with a way back. An unpublished edition should be a friendly page, not an error. Raise secondary text contrast, make focus visible on every interactive element including the masthead, bring touch targets up to a comfortable size, always pair status colour with a word, and honour reduced motion.
Acceptance: the archived edition page and any missing route render a friendly page with navigation; the whole site is operable by keyboard with a visible focus ring; body text meets contrast at normal size; motion stops when the reader asks for reduced motion.

Phase F. Editorial pass on the story pages
Direction: bring alumni, donate and editions up to the homepage standard of hierarchy, photography and breathing room. Alumni gains pacing and a closing action. Donate gains a header, a short reason to give and the footer. An edition reads as a record of that weekend rather than a table.
Acceptance: each page opens with a clear hero, alternates rhythm rather than stacking one narrow column, ends with an action, and holds up at mobile.

Phase G. Member page rebuild
Direction: `/me` becomes the personal counterpart to the homepage: identity and this year's answer at the top as the primary card, then the quieter record sections. Same shapes and photography language, more warmth than the current form.
Acceptance: a member can see and change their answer without scrolling; every existing capability still works; nothing organizer only is exposed.

## 5. Pages that should stay quiet or dense

- `/admin` is a working tool for three people. It should inherit the shared header, footer, buttons, fields, tables and status words, and the accessibility fixes, but it should stay dense, table first, and free of photography and hero treatment. Do not apply the editorial pass here.
- `/qr` is a printable poster. Leave the layout and chrome free rendering alone.
- `/rsvp` is a single decision arriving from an email. It should stay minimal and chrome light; only wording, focus and contrast change.
- `/auth` stays a short centred column. Magic link stays first, Google second and never required.

## 6. Constraints carried through every phase

- Saying whether you are coming is the signup. No page gains a bare sign up or create account control.
- Gold means attending and nothing else.
- No page exposes an email address publicly.
- No historical record is rewritten, and existing links, redirects and calendar endpoints keep working.
