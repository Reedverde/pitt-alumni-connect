import { createFileRoute, redirect } from "@tanstack/react-router";

/** /weekend moved to /schedule. Old links live in already-sent emails, printed
 *  QR handouts, and bookmarks, so this stub 301s forever and carries the query
 *  string (src=email attribution) across. Hash fragments never reach the
 *  server, so #where-to-stay links from before the move land on the top of
 *  /schedule; every internal hash link now points at /schedule directly. */
export const Route = createFileRoute("/weekend")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/schedule", search: search as Record<string, unknown>, statusCode: 301 });
  },
  head: () => ({
    meta: [
      { title: "Schedule moved — Pitt Club Ultimate" },
      { name: "robots", content: "noindex" },
    ],
  }),
});
