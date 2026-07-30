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
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background-color:#ffffff" bgcolor="#ffffff">
<tr>${sealCell}<td align="left" style="background-color:#ffffff;font-family:${FONT_STACK};font-size:16px;font-weight:bold;letter-spacing:0.02em;text-transform:uppercase;color:${ROYAL}" bgcolor="#ffffff">PITT CLUB ULTIMATE</td></tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px">
<tr><td height="1" style="height:1px;line-height:1px;font-size:1px;background-color:${CHALK}" bgcolor="${CHALK}">&nbsp;</td></tr>
</table>`;
}

/** Wraps body HTML in the shell. Background is pure white on every surface,
 *  and colour-scheme is pinned to light so a dark-mode client does not invert
 *  the lockup into an unreadable white-on-black block. */
export function emailShell(bodyHtml: string, preheader?: string) {
  const pre = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
</head>
<body style="margin:0;padding:24px;background-color:#ffffff;font-family:${FONT_STACK};font-size:16px;line-height:1.55;color:${INK}" bgcolor="#ffffff">
${pre}<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background-color:#ffffff" bgcolor="#ffffff"><tr><td align="left" style="background-color:#ffffff" bgcolor="#ffffff">
${emailHeader()}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px"><tr><td align="left" style="padding:20px 0 0;font-family:${FONT_STACK};font-size:16px;line-height:1.55;color:${INK};background-color:#ffffff" bgcolor="#ffffff">
${bodyHtml}
</td></tr></table>
</td></tr></table>
</body></html>`;
}

export function emailParagraph(text: string) {
  return `<p style="margin:0 0 16px;font-family:${FONT_STACK};font-size:16px;line-height:1.55;color:${INK}">${escapeHtml(
    text,
  )}</p>`;
}

/** Royal, underlined, never gold. Bulletproof enough for Outlook without VML. */
export function emailButton(href: string, label: string) {
  const url = escapeHtml(href);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px"><tr>
<td align="center" bgcolor="${ROYAL}" style="background-color:${ROYAL};border-radius:7px">
<a href="${url}" style="display:inline-block;padding:14px 26px;font-family:${FONT_STACK};font-size:15px;font-weight:bold;text-transform:uppercase;letter-spacing:0.02em;color:#ffffff;text-decoration:none">${escapeHtml(
    label,
  )}</a></td></tr></table>`;
}

/** The same destination as plain visible text, so a person can read the host
 *  and see the link is genuine even if the button does not render. */
export function emailPlainUrl(href: string) {
  const url = escapeHtml(href);
  return `<p style="margin:0 0 16px;font-family:${FONT_STACK};font-size:13px;line-height:1.5;word-break:break-all;color:${STERLING}">Or paste this into your browser:<br><a href="${url}" style="color:${ROYAL};text-decoration:underline">${url}</a></p>`;
}
