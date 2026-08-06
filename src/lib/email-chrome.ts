/** Shared chrome for every outbound message.
 *
 *  Hard constraints this file exists to hold in one place:
 *  - No webfonts. Email clients ignore them, so the stack is Arial and the
 *    identity is carried by colour, rules and structure.
 *  - The wordmark PITT CLUB ULTIMATE is live text, never an image, because a
 *    large share of recipients block images by default.
 *  - Tables and inline CSS only. No flexbox, no grid, no custom properties,
 *    no external stylesheet, no borders where a background row will do.
 *  - Umbrella level only. No team name, no division mark, no team logo.
 */

export const FONT_STACK = "Arial, Helvetica, sans-serif";
export const ROYAL = "#003594";
export const INK = "#1C2536";
export const CHALK = "#D5DAE2";
export const STERLING = "#6B7280";
export const GOLD = "#FFB81C"; // going confirmation only, never chrome

export function escapeHtml(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** The seal image. It must be a flat single-colour #0B0B0C export hosted in
 *  the photos bucket so a non-developer admin can replace it: set
 *  MAIL_SEAL_URL to that public URL. No approved flat file exists in the
 *  project today, so until the secret is set the header renders the live-text
 *  wordmark alone rather than slicing the shield PNG. */
export function sealUrl(): string | null {
  const raw = process.env.MAIL_SEAL_URL?.trim();
  return raw && /^https:\/\/\S+$/.test(raw) ? raw : null;
}

/** Lockup plus the rule beneath it. */
export function emailHeader() {
  const seal = sealUrl();
  const sealCell = seal
    ? `<td width="32" style="padding:0 10px 0 0;background-color:#ffffff" bgcolor="#ffffff"><img src="${escapeHtml(
        seal,
      )}" width="32" height="32" alt="Pitt Club Ultimate" style="display:block;width:32px;height:32px;border:0;outline:none;text-decoration:none"></td>`
    : "";
  return `<table role="presentation" class="e-bg" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background-color:#ffffff" bgcolor="#ffffff">
<tr>${sealCell}<td align="left" class="e-mark" style="background-color:#ffffff;font-family:${FONT_STACK};font-size:16px;font-weight:bold;letter-spacing:0.02em;text-transform:uppercase;color:${ROYAL}" bgcolor="#ffffff">PITT CLUB ULTIMATE</td></tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px">
<tr><td height="1" class="e-rule" style="height:1px;line-height:1px;font-size:1px;background-color:${CHALK}" bgcolor="${CHALK}">&nbsp;</td></tr>
</table>`;
}

export const SABAH_BLACK = "#0B0B0C";
export const FIELD_WHITE = "#FBFBFC";
/** Royal is too dark to sit on near-black, so the dark surface uses a lifted
 *  royal for the button fill and link text. Still royal, never gold. */
export const ROYAL_LIFT = "#6E9BF0";

/** Dark-mode overrides. Clients that honour prefers-color-scheme (Apple Mail,
 *  iOS, Outlook mac) get a deliberate near-black surface instead of a client
 *  guessed mid-grey. Clients that ignore it keep the explicit bgcolor
 *  attributes below and stay white. */
const DARK_CSS = `
@media (prefers-color-scheme: dark) {
  .e-bg, .e-bg > tbody > tr > td { background-color: ${SABAH_BLACK} !important; }
  .e-text, .e-text a { color: ${FIELD_WHITE} !important; }
  .e-muted { color: #9AA3B2 !important; }
  .e-rule { background-color: #2A2F3A !important; }
  .e-mark { color: ${ROYAL_LIFT} !important; }
  table.e-btn, td.e-btn { background-color: ${ROYAL_LIFT} !important; }
  td.e-btn a { color: ${SABAH_BLACK} !important; }
  .e-url a { color: ${ROYAL_LIFT} !important; }
}
[data-ogsc] .e-bg, [data-ogsc] .e-bg > tbody > tr > td { background-color: ${SABAH_BLACK} !important; }
[data-ogsc] .e-text, [data-ogsc] .e-text a { color: ${FIELD_WHITE} !important; }
[data-ogsc] .e-muted { color: #9AA3B2 !important; }
[data-ogsc] .e-mark { color: ${ROYAL_LIFT} !important; }
[data-ogsc] td.e-btn { background-color: ${ROYAL_LIFT} !important; }
[data-ogsc] td.e-btn a { color: ${SABAH_BLACK} !important; }
`.trim();

/** Wraps body HTML in the shell. Every cell carries an explicit bgcolor and an
 *  explicit colour so no client has to invent one; dark mode is an intentional
 *  near-black surface rather than an inversion. */
export function emailShell(bodyHtml: string, preheader?: string) {
  const pre = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<style>${DARK_CSS}</style>
</head>
<body class="e-bg" style="margin:0;padding:24px;background-color:#ffffff;font-family:${FONT_STACK};font-size:16px;line-height:1.55;color:${INK}" bgcolor="#ffffff">
${pre}<table role="presentation" class="e-bg" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background-color:#ffffff" bgcolor="#ffffff"><tr><td align="left" style="background-color:#ffffff" bgcolor="#ffffff">
${emailHeader()}
<table role="presentation" class="e-bg" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px"><tr><td align="left" style="padding:20px 0 0;font-family:${FONT_STACK};font-size:16px;line-height:1.55;color:${INK};background-color:#ffffff" bgcolor="#ffffff">
${bodyHtml}
</td></tr></table>
</td></tr></table>
</body></html>`;
}

export function emailParagraph(text: string) {
  return `<p class="e-text" style="margin:0 0 16px;font-family:${FONT_STACK};font-size:16px;line-height:1.55;color:${INK}">${escapeHtml(
    text,
  )}</p>`;
}

/** Secondary line. Sterling, quieter than the sign-in instruction above it. */
export function emailMuted(text: string) {
  return `<p class="e-muted" style="margin:0 0 10px;font-family:${FONT_STACK};font-size:15px;line-height:1.5;color:${STERLING}">${escapeHtml(
    text,
  )}</p>`;
}

/** Closing rule plus a quiet identifying line. No opt-out link: this message
 *  is the sign-in link, and suppressing an address here would lock the person
 *  out of their own record. The List-Unsubscribe header stays on the send. */
export function emailFooter(lines: string[]) {
  return `<table role="presentation" class="e-bg" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:24px 0 0">
<tr><td height="1" class="e-rule" style="height:1px;line-height:1px;font-size:1px;background-color:${CHALK}" bgcolor="${CHALK}">&nbsp;</td></tr>
<tr><td align="left" style="padding:12px 0 0;background-color:#ffffff" bgcolor="#ffffff">${lines
    .map(
      (l) =>
        `<p class="e-muted" style="margin:0 0 4px;font-family:${FONT_STACK};font-size:12px;line-height:1.5;color:${STERLING}">${escapeHtml(
          l,
        )}</p>`,
    )
    .join("")}</td></tr>
</table>`;
}

/** Royal, underlined, never gold. Bulletproof enough for Outlook without VML. */
export function emailButton(href: string, label: string) {
  const url = escapeHtml(href);
  return `<table role="presentation" class="e-btn" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px"><tr>
<td align="center" class="e-btn" bgcolor="${ROYAL}" style="background-color:${ROYAL};border-radius:7px">
<a href="${url}" style="display:inline-block;padding:14px 26px;font-family:${FONT_STACK};font-size:15px;font-weight:bold;text-transform:uppercase;letter-spacing:0.02em;color:#ffffff;text-decoration:none">${escapeHtml(
    label,
  )}</a></td></tr></table>`;
}

/** The same destination as plain visible text, so a person can read the host
 *  and see the link is genuine even if the button does not render. */
export function emailPlainUrl(href: string) {
  const url = escapeHtml(href);
  return `<p class="e-url" style="margin:0 0 20px;font-family:${FONT_STACK};font-size:13px;line-height:1.5;word-break:break-all;color:${STERLING}">Or paste this into your browser:<br><a href="${url}" style="color:${ROYAL};text-decoration:underline">${url}</a></p>`;
}

/** Optional hosted PNG of the Discord mark. Email clients do not render inline
 *  SVG, so the glyph is a PNG or it is omitted entirely; the words never move
 *  into the image, so nothing is lost when images are blocked. */
function discordGlyphUrl(): string | null {
  const raw = process.env.MAIL_DISCORD_ICON_URL?.trim();
  return raw && /^https:\/\/\S+$/.test(raw) ? raw : null;
}

/** The social row that sits above the unsubscribe line in every drip message.
 *  Royal fill, white text, 7px radius. Never gold. The second cell is left
 *  empty on purpose: an Instagram button will sit beside Discord later. */
export function emailSocialBlock(discordUrl: string) {
  const href = escapeHtml(discordUrl);
  const glyph = discordGlyphUrl();
  const glyphImg = glyph
    ? `<img src="${escapeHtml(
        glyph,
      )}" width="16" height="16" alt="Discord" style="display:inline-block;vertical-align:middle;border:0;margin-right:8px"> `
    : "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0"><tr>
<td align="left" class="e-btn" bgcolor="${ROYAL}" style="background-color:${ROYAL};border-radius:7px">
<a href="${href}" style="display:inline-block;padding:12px 22px;font-family:${FONT_STACK};font-size:14px;font-weight:bold;letter-spacing:0.02em;color:#ffffff;text-decoration:none">${glyphImg}Join the Discord</a></td>
<!-- Instagram button sits here once a handle exists. -->
<td width="12" style="width:12px">&nbsp;</td>
<td align="left">&nbsp;</td>
</tr></table>
<p class="e-url" style="margin:8px 0 0;font-family:${FONT_STACK};font-size:12px;line-height:1.5;word-break:break-all;color:${STERLING}"><a href="${href}" style="color:${ROYAL};text-decoration:underline">${href}</a></p>`;
}
