import { createFileRoute } from "@tanstack/react-router";

/** Single-purpose headcount link from the T-10 email. It updates one number on
 *  one row. It is NOT a magic link: no session is created, no cookie is set,
 *  no identity is verified, and no status is read or written here. */
const escape = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

function page(body: string, status = 200) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Headcount</title></head>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:48px auto;padding:0 20px;color:#1C2536">
${body}
</body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

function form(token: string, size: number) {
  const options = Array.from({ length: 12 }, (_, i) => i + 1)
    .map((n) => `<option value="${n}"${n === size ? " selected" : ""}>${n}</option>`)
    .join("");
  return page(`<h1 style="font-size:22px">How many of you, including yourself?</h1>
<form method="post">
  <input type="hidden" name="t" value="${escape(token)}">
  <select name="size" style="font-size:18px;padding:8px 10px">${options}</select>
  <button type="submit" style="font-size:15px;padding:9px 16px;margin-left:8px;background:#003594;color:#fff;border:0;border-radius:7px">Save</button>
</form>
<p style="font-size:13px;color:#6B7280">Changing this number does not change whether you are coming.</p>`);
}

export const Route = createFileRoute("/api/public/headcount")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("t") ?? "";
        const { partySizeForToken } = await import("@/lib/party-token.server");
        const current = await partySizeForToken(token);
        if (current === null) return page("<p>This link is no longer valid.</p>", 400);
        return form(token, current);
      },
      POST: async ({ request }) => {
        const body = await request.formData();
        const token = String(body.get("t") ?? "");
        const size = Number(body.get("size") ?? 1);
        const { applyPartySizeToken } = await import("@/lib/party-token.server");
        const result = await applyPartySizeToken(token, size);
        if (!result.ok) return page("<p>This link is no longer valid.</p>", 400);
        return page(
          `<p>Thanks. We have you down for ${result.partySize}. You are still coming, nothing else changed.</p>`,
        );
      },
    },
  },
});
